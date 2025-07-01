
"use client";

import React, { useState, useMemo, useEffect } from 'react';
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
import { KanbanSquare, PlusCircle, Download, Loader2, AlertTriangle, Bot } from 'lucide-react';

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

// Zod Schema for the New Order Form
const orderFormSchema = z.object({
  name: z.string().min(3, "Название должно быть не менее 3 символов."),
  description: z.string().min(10, "Описание должно быть не менее 10 символов."),
  currentOwnerId: z.string({ required_error: "Выберите ответственного." }),
  strategicGoalId: z.string({ required_error: "Выберите стратегическую цель." }),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Выберите корректную дату." }),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export default function DepartmentManager() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCheckingForDuplicates, setIsCheckingForDuplicates] = useState(false);
  const [similarTasksInfo, setSimilarTasksInfo] = useState<FindSimilarTasksOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      name: '',
      description: '',
      currentOwnerId: undefined,
      strategicGoalId: undefined,
      dueDate: '',
    },
  });

  const updateIceScore = (index: number, field: 'influence' | 'confidence' | 'effort', value: number) => {
    setOrders(prevOrders => {
      const newOrders = [...prevOrders];
      const order = { ...newOrders[index], [field]: value };
      order.iceScore = order.influence * order.confidence * order.effort;
      newOrders[index] = order;
      return newOrders;
    });
  };

  const handleFormSubmit = async (data: OrderFormValues) => {
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
        // Don't add the task yet, let the user decide in the dialog
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
        influence: 5,
        confidence: 5,
        effort: 5,
        iceScore: 5 * 5 * 5,
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
  
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => b.iceScore - a.iceScore);
  }, [orders]);


  return (
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
                <Button><PlusCircle className="mr-2 h-4 w-4"/>Новый заказ</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                  <DialogTitle>Создание нового заказа</DialogTitle>
                  <DialogDescription>Заполните информацию о новом проекте или задаче.</DialogDescription>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger></FormControl>
                                    <SelectContent>{mockEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField name="strategicGoalId" control={form.control} render={({ field }) => (
                            <FormItem><FormLabel>Стратегическая цель</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Выберите цель" /></SelectTrigger></FormControl>
                                    <SelectContent>{mockStrategicGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField name="dueDate" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Срок выполнения</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                     )} />
                    
                    {similarTasksInfo && similarTasksInfo.similarTaskIds.length > 0 && (
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
                      {similarTasksInfo && similarTasksInfo.similarTaskIds.length > 0 ? (
                        <Button type="button" variant="secondary" onClick={() => addNewOrder(form.getValues(), true)}>Все равно создать</Button>
                      ) : null}
                      <Button type="submit" disabled={isCheckingForDuplicates}>
                        {isCheckingForDuplicates ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Проверка...</> : "Создать заказ"}
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
              <TableHead className="w-[20%]">Стратегическая цель</TableHead>
              <TableHead className="w-[10%]">Статус</TableHead>
              <TableHead className="w-[10%] text-center">I</TableHead>
              <TableHead className="w-[10%] text-center">C</TableHead>
              <TableHead className="w-[10%] text-center">E</TableHead>
              <TableHead className="w-[10%] text-center font-bold">ICE</TableHead>
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
                  <Slider defaultValue={[order.influence]} max={10} min={1} step={1} onValueChange={([val]) => updateIceScore(index, 'influence', val)} />
                  <p className="text-center text-xs mt-1">{order.influence}</p>
                </TableCell>
                <TableCell>
                  <Slider defaultValue={[order.confidence]} max={10} min={1} step={1} onValueChange={([val]) => updateIceScore(index, 'confidence', val)} />
                   <p className="text-center text-xs mt-1">{order.confidence}</p>
                </TableCell>
                <TableCell>
                  <Slider defaultValue={[order.effort]} max={10} min={1} step={1} onValueChange={([val]) => updateIceScore(index, 'effort', val)} />
                   <p className="text-center text-xs mt-1">{order.effort}</p>
                </TableCell>
                <TableCell className="text-center text-lg font-bold">{order.iceScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
         {/* Simple Chatbot PoC Section */}
        <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Bot className="h-6 w-6 text-primary"/>AI-Ассистент</h3>
            <p className="text-sm text-muted-foreground mb-4">Задайте вопрос по текущим заказам (контекст ограничен таблицей выше).</p>
            <div className="border p-4 rounded-lg bg-muted/20 min-h-[100px] text-center flex items-center justify-center">
                <p className="text-muted-foreground">Интерактивный чат-бот в разработке...</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
