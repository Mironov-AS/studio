
"use client";

import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { nanoid } from 'nanoid';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { findSimilarTasks, FindSimilarTasksOutput } from '@/ai/flows/find-similar-tasks-flow';
import { chatWithBacklog, ChatWithBacklogOutput } from '@/ai/flows/chat-with-backlog-flow';
import { KanbanSquare, PlusCircle, Download, Loader2, AlertTriangle, Bot, Send, BarChart2, PieChart as PieChartIcon, Edit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";


// Data Structures (TypeScript Types)
type Status = 'Планируется' | 'Выполняется' | 'Завершен' | 'Отклонён' | 'Приостановлен';

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface StrategicGoal {
  id: string;
  name: string;
}

interface Order {
  id: string;
  name: string;
  description: string;
  initiator: Employee;
  currentOwner: Employee;
  strategicGoal: StrategicGoal;
  valueDriver: string;
  expectedEffect: string;
  dueDate: string;
  status: Status;
  influence: number;
  confidence: number;
  effort: number;
  iceScore: number;
}

interface ChatMessage {
    role: 'user' | 'ai';
    text: string;
}

// Mock Data (will be replaced by a real backend/DB in a full application)
const mockEmployees: Employee[] = [
  { id: 'emp1', name: 'Иванов Иван', role: 'Менеджер проекта' },
  { id: 'emp2', name: 'Петрова Анна', role: 'Аналитик' },
  { id: 'emp3', name: 'Сидоров Олег', role: 'Разработчик' },
  { id: 'emp4', name: 'Кузнецова Мария', role: 'Дата-сайентист' },
];

const mockStrategicGoals: StrategicGoal[] = [
  { id: 'goal1', name: 'Увеличение доли рынка на 5%' },
  { id: 'goal2', name: 'Снижение операционных издержек на 10%' },
  { id: 'goal3', name: 'Повышение удовлетворенности клиентов (NPS) до 75' },
];

const mockOrders: Order[] = [
  {
    id: nanoid(),
    name: 'Внедрение нового CRM',
    description: 'Переход на новую CRM-систему для улучшения взаимодействия с клиентами.',
    initiator: mockEmployees[0],
    currentOwner: mockEmployees[0],
    strategicGoal: mockStrategicGoals[2],
    valueDriver: 'Увеличение продаж',
    expectedEffect: '+15% к конверсии',
    dueDate: '2024-12-31',
    status: 'Выполняется',
    influence: 9,
    confidence: 8,
    effort: 4,
    iceScore: 9 * 8 * 4,
  },
  {
    id: nanoid(),
    name: 'Оптимизация логистики склада',
    description: 'Автоматизация процессов приемки и отгрузки товаров на центральном складе.',
    initiator: mockEmployees[1],
    currentOwner: mockEmployees[1],
    strategicGoal: mockStrategicGoals[1],
    valueDriver: 'Экономия ресурсов',
    expectedEffect: '-20% на складские расходы',
    dueDate: '2024-10-01',
    status: 'Планируется',
    influence: 7,
    confidence: 9,
    effort: 6,
    iceScore: 7 * 9 * 6,
  },
];

// Zod Schema for the New/Edit Order Form
const orderFormSchema = z.object({
  name: z.string().min(3, "Название должно быть не менее 3 символов."),
  description: z.string().min(10, "Описание должно быть не менее 10 символов."),
  currentOwnerId: z.string({ required_error: "Выберите ответственного." }),
  strategicGoalId: z.string({ required_error: "Выберите стратегическую цель." }),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Выберите корректную дату." }),
  influence: z.number().min(1).max(10),
  confidence: z.number().min(1).max(10),
  effort: z.number().min(1).max(10),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function DepartmentManager() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // AI States
  const [isCheckingForDuplicates, setIsCheckingForDuplicates] = useState(false);
  const [similarTasksInfo, setSimilarTasksInfo] = useState<FindSimilarTasksOutput | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const { toast } = useToast();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      name: '',
      description: '',
      currentOwnerId: undefined,
      strategicGoalId: undefined,
      dueDate: '',
      influence: 5,
      confidence: 5,
      effort: 5,
    },
  });

  useEffect(() => {
    if (isFormOpen && editingOrder) {
      form.reset({
        name: editingOrder.name,
        description: editingOrder.description,
        currentOwnerId: editingOrder.currentOwner.id,
        strategicGoalId: editingOrder.strategicGoal.id,
        dueDate: editingOrder.dueDate,
        influence: editingOrder.influence,
        confidence: editingOrder.confidence,
        effort: editingOrder.effort,
      });
    } else {
      form.reset();
    }
  }, [isFormOpen, editingOrder, form]);
  
  // ---- Statistics Calculation ----
  const stats = useMemo(() => {
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {} as Record<Status, number>);

    const employeeCounts = orders.reduce((acc, order) => {
        acc[order.currentOwner.name] = (acc[order.currentOwner.name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const goalCounts = orders.reduce((acc, order) => {
        acc[order.strategicGoal.name] = (acc[order.strategicGoal.name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return {
        statusData: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
        employeeData: Object.entries(employeeCounts).map(([name, value]) => ({ name, value })),
        goalData: Object.entries(goalCounts).map(([name, value]) => ({ name, value })),
    };
  }, [orders]);


  const updateIceScore = (orderId: string, field: 'influence' | 'confidence' | 'effort', value: number) => {
    setOrders(prevOrders => {
      const newOrders = [...prevOrders];
      const orderIndex = newOrders.findIndex(o => o.id === orderId);
      if (orderIndex === -1) return prevOrders;
      
      const order = { ...newOrders[orderIndex], [field]: value };
      order.iceScore = order.influence * order.confidence * order.effort;
      newOrders[orderIndex] = order;
      return newOrders;
    });
  };

  const handleOpenNewOrderForm = () => {
    setEditingOrder(null);
    setIsFormOpen(true);
  };
  
  const handleOpenEditOrderForm = (order: Order) => {
    setEditingOrder(order);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: OrderFormValues) => {
    const iceScore = data.influence * data.confidence * data.effort;

    if (editingOrder) {
      // Logic for updating an existing order
      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === editingOrder.id
            ? {
                ...o,
                name: data.name,
                description: data.description,
                currentOwner: mockEmployees.find(e => e.id === data.currentOwnerId)!,
                strategicGoal: mockStrategicGoals.find(g => g.id === data.strategicGoalId)!,
                dueDate: data.dueDate,
                influence: data.influence,
                confidence: data.confidence,
                effort: data.effort,
                iceScore: iceScore,
              }
            : o
        )
      );
      toast({ title: "Заказ успешно обновлен" });
      resetAndCloseForm();
      return;
    }
    
    // Logic for creating a new order
    setIsCheckingForDuplicates(true);
    setSimilarTasksInfo(null);
    try {
      const existingTasksJson = JSON.stringify(
        orders.map(o => ({ id: o.id, name: o.name, description: o.description }))
      );
      const result = await findSimilarTasks({
        newTaskDescription: `${data.name}. ${data.description}`,
        existingTasksJson,
      });

      setSimilarTasksInfo(result);

      if (result.similarTaskIds.length > 0) {
        toast({
          title: "Внимание: Найдены похожие задачи!",
          description: "AI обнаружил возможные дубликаты. Проверьте информацию ниже.",
          variant: "default",
          duration: 7000,
        });
      } else {
        addNewOrder(data);
        toast({
          title: "Заказ добавлен",
          description: result.reasoning,
        });
        resetAndCloseForm();
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Ошибка при проверке на дубликаты", variant: "destructive" });
      addNewOrder(data); // Add order anyway if AI check fails
      resetAndCloseForm();
    } finally {
      setIsCheckingForDuplicates(false);
    }
  };
  
  const addNewOrder = (data: OrderFormValues, force = false) => {
     const iceScore = data.influence * data.confidence * data.effort;
     const newOrder: Order = {
        id: nanoid(),
        name: data.name,
        description: data.description,
        initiator: mockEmployees[0], // Assuming current user is the first employee
        currentOwner: mockEmployees.find(e => e.id === data.currentOwnerId)!,
        strategicGoal: mockStrategicGoals.find(g => g.id === data.strategicGoalId)!,
        valueDriver: 'Не определен', // Placeholder
        expectedEffect: 'Не определен', // Placeholder
        dueDate: data.dueDate,
        status: 'Планируется',
        influence: data.influence,
        confidence: data.confidence,
        effort: data.effort,
        iceScore: iceScore,
      };
      setOrders(prev => [...prev, newOrder]);
      if (force) {
        toast({ title: "Заказ добавлен принудительно." });
        resetAndCloseForm();
      }
  }

  const resetAndCloseForm = () => {
    form.reset();
    setSimilarTasksInfo(null);
    setEditingOrder(null);
    setIsFormOpen(false);
  }

  const exportToXLSX = () => {
    const dataToExport = orders.map(o => ({
      'ID': o.id,
      'Название': o.name,
      'Инициатор': o.initiator.name,
      'Ответственный': o.currentOwner.name,
      'Статус': o.status,
      'ICE Score': o.iceScore,
      'Влияние (I)': o.influence,
      'Уверенность (C)': o.confidence,
      'Усилия (E)': o.effort,
      'Срок': o.dueDate,
      'Стратегическая цель': o.strategicGoal.name,
      'Описание': o.description,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Заказы');
    XLSX.writeFile(workbook, 'Управление_Подразделением_Заказы.xlsx');
    toast({ title: "Экспорт успешен" });
  };
  
  const handleSendMessage = async (e: FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isChatLoading) return;
      
      const userMessage: ChatMessage = { role: 'user', text: chatInput };
      setChatHistory(prev => [...prev, userMessage]);
      setChatInput('');
      setIsChatLoading(true);

      try {
        const backlogJson = JSON.stringify(orders);
        const result: ChatWithBacklogOutput = await chatWithBacklog({ userQuestion: userMessage.text, backlogJson });
        const aiMessage: ChatMessage = { role: 'ai', text: result.answer };
        setChatHistory(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error("Chatbot error:", error);
        const errorMessage: ChatMessage = { role: 'ai', text: "Извините, произошла ошибка. Не могу сейчас ответить." };
        setChatHistory(prev => [...prev, errorMessage]);
      } finally {
        setIsChatLoading(false);
      }
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => b.iceScore - a.iceScore);
  }, [orders]);


  return (
    <div className="space-y-6">
      <Card className="w-full shadow-xl rounded-xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-3 text-3xl font-bold">
              <KanbanSquare className="h-8 w-8 text-accent" />
              Система управления подразделением
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={exportToXLSX} variant="outline"><Download className="mr-2 h-4 w-4"/> Экспорт в XLSX</Button>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenNewOrderForm}><PlusCircle className="mr-2 h-4 w-4"/>Новый заказ</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                  <DialogHeader>
                    <DialogTitle>{editingOrder ? 'Редактирование заказа' : 'Создание нового заказа'}</DialogTitle>
                    <DialogDescription>
                      {editingOrder ? `Редактирование заказа "${editingOrder.name}"` : 'Заполните информацию о новом проекте или задаче.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                      <FormField name="name" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Название заказа</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField name="description" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Описание/Цель проекта</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                          <FormField name="currentOwnerId" control={form.control} render={({ field }) => (
                              <FormItem><FormLabel>Текущий ответственный</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger></FormControl>
                                      <SelectContent>{mockEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                                  </Select>
                              <FormMessage /></FormItem>
                          )} />
                          <FormField name="strategicGoalId" control={form.control} render={({ field }) => (
                              <FormItem><FormLabel>Стратегическая цель</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Выберите цель" /></SelectTrigger></FormControl>
                                      <SelectContent>{mockStrategicGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                                  </Select>
                              <FormMessage /></FormItem>
                          )} />
                      </div>
                       <FormField name="dueDate" control={form.control} render={({ field }) => (
                          <FormItem><FormLabel>Срок выполнения</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                       )} />
                      
                       <div className="space-y-4 rounded-md border p-4">
                        <h4 className="mb-4 text-sm font-medium leading-none">Оценка ICE</h4>
                        <FormField name="influence" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Влияние (Influence): {field.value}</FormLabel>
                            <FormControl>
                              <Slider defaultValue={[field.value]} max={10} min={1} step={1} onValueChange={(value) => field.onChange(value[0])} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="confidence" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Уверенность (Confidence): {field.value}</FormLabel>
                            <FormControl>
                              <Slider defaultValue={[field.value]} max={10} min={1} step={1} onValueChange={(value) => field.onChange(value[0])} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="effort" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Усилия (Effort): {field.value}</FormLabel>
                            <FormControl>
                              <Slider defaultValue={[field.value]} max={10} min={1} step={1} onValueChange={(value) => field.onChange(value[0])} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      {similarTasksInfo && similarTasksInfo.similarTaskIds.length > 0 && !editingOrder && (
                          <Card className="bg-destructive/10 border-destructive/50 p-4">
                              <CardHeader className="p-0">
                                 <CardTitle className="text-destructive text-lg flex items-center gap-2"><AlertTriangle/> Возможный дубликат!</CardTitle>
                              </CardHeader>
                              <CardContent className="p-0 pt-2">
                                  <p className="text-sm text-destructive-foreground">{similarTasksInfo.reasoning}</p>
                                  <ul className="list-disc pl-5 mt-2 text-sm">
                                      {similarTasksInfo.similarTaskIds.map(id => {
                                          const task = orders.find(o => o.id === id);
                                          return <li key={id}><strong>{task?.name}</strong> (Отв: {task?.currentOwner.name})</li>
                                      })}
                                  </ul>
                              </CardContent>
                          </Card>
                      )}
                      
                      <DialogFooter>
                        {similarTasksInfo && similarTasksInfo.similarTaskIds.length > 0 && !editingOrder ? (
                          <Button type="button" variant="secondary" onClick={() => addNewOrder(form.getValues(), true)}>Все равно создать</Button>
                        ) : null}
                        <Button type="submit" disabled={isCheckingForDuplicates}>
                          {isCheckingForDuplicates ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Проверка...</> : (editingOrder ? 'Сохранить изменения' : 'Создать заказ')}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <CardDescription>
            Прототип системы для управления задачами. Данные хранятся в браузере и сбрасываются при перезагрузке.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Название/Ответственный</TableHead>
                <TableHead className="w-[15%]">Стратегическая цель</TableHead>
                <TableHead className="w-[12%]">Статус</TableHead>
                <TableHead className="w-[10%] text-center">I</TableHead>
                <TableHead className="w-[10%] text-center">C</TableHead>
                <TableHead className="w-[10%] text-center">E</TableHead>
                <TableHead className="w-[8%] text-center font-bold">ICE</TableHead>
                <TableHead className="w-[5%] text-center">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrders.map((order, index) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <p className="font-medium">{order.name}</p>
                    <p className="text-sm text-muted-foreground">{order.currentOwner.name}</p>
                  </TableCell>
                  <TableCell className="text-sm">{order.strategicGoal.name}</TableCell>
                  <TableCell>
                    <Select value={order.status} onValueChange={(newStatus) => setOrders(orders.map(o => o.id === order.id ? {...o, status: newStatus as Status} : o))}>
                      <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Планируется">Планируется</SelectItem>
                        <SelectItem value="Выполняется">Выполняется</SelectItem>
                        <SelectItem value="Завершен">Завершен</SelectItem>
                        <SelectItem value="Отклонён">Отклонён</SelectItem>
                        <SelectItem value="Приостановлен">Приостановлен</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Slider defaultValue={[order.influence]} max={10} min={1} step={1} onValueChange={([val]) => updateIceScore(order.id, 'influence', val)} />
                    <p className="text-center text-xs mt-1">{order.influence}</p>
                  </TableCell>
                  <TableCell>
                    <Slider defaultValue={[order.confidence]} max={10} min={1} step={1} onValueChange={([val]) => updateIceScore(order.id, 'confidence', val)} />
                     <p className="text-center text-xs mt-1">{order.confidence}</p>
                  </TableCell>
                  <TableCell>
                    <Slider defaultValue={[order.effort]} max={10} min={1} step={1} onValueChange={([val]) => updateIceScore(order.id, 'effort', val)} />
                     <p className="text-center text-xs mt-1">{order.effort}</p>
                  </TableCell>
                  <TableCell className="text-center text-lg font-bold">{order.iceScore}</TableCell>
                   <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditOrderForm(order)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-xl">
        <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-bold"><BarChart2 className="h-8 w-8 text-accent"/>Статистика</CardTitle>
            <CardDescription>Обзор текущего состояния заказов.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><PieChartIcon className="h-5 w-5"/>Статусы</CardTitle></CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="h-[200px] w-full">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {stats.statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltipContent hideLabel />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
             <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-lg">Загрузка и цели</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-semibold mb-2 text-sm">Заказы на сотрудника</h4>
                         <ChartContainer config={{}} className="h-[200px] w-full">
                            <ResponsiveContainer>
                                <BarChart data={stats.employeeData} layout="vertical" margin={{ left: 50 }}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 12}}/>
                                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent hideLabel />}/>
                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={4}/>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                    <div>
                       <h4 className="font-semibold mb-2 text-sm">Заказы по целям</h4>
                        <ChartContainer config={{}} className="h-[200px] w-full">
                            <ResponsiveContainer>
                                <BarChart data={stats.goalData} layout="vertical" margin={{ left: 50 }}>
                                     <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10}}/>
                                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent hideLabel />}/>
                                    <Bar dataKey="value" fill="hsl(var(--secondary))" radius={4}/>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-xl">
        <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-bold"><Bot className="h-8 w-8 text-accent"/>AI-Ассистент</CardTitle>
            <CardDescription>Задайте вопрос по текущим заказам. Например: "Какие задачи у Петрова?" или "Покажи все проекты со статусом 'Завершен'".</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="border rounded-lg p-4 bg-muted/20">
             <ScrollArea className="h-60 w-full mb-4 pr-4">
                {chatHistory.length === 0 && <div className="flex h-full items-center justify-center text-muted-foreground">Здесь будет история чата...</div>}
                <div className="space-y-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                         {msg.role === 'ai' && <Bot className="h-6 w-6 shrink-0 text-primary"/>}
                         <div className={`rounded-lg px-4 py-2 max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                         </div>
                    </div>
                ))}
                {isChatLoading && (
                    <div className="flex items-start gap-3">
                        <Bot className="h-6 w-6 shrink-0 text-primary"/>
                        <div className="rounded-lg px-4 py-2 bg-background"><Loader2 className="h-5 w-5 animate-spin"/></div>
                    </div>
                )}
                </div>
             </ScrollArea>
             <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Спросите что-нибудь..." disabled={isChatLoading} />
                <Button type="submit" disabled={isChatLoading || !chatInput.trim()}><Send className="h-4 w-4"/></Button>
             </form>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
