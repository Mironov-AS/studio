
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateBacklogFromBrainstorm, type GenerateBacklogOutput, type BacklogItem } from '@/ai/flows/generate-backlog-from-brainstorm-flow';
import { Loader2, FileUp, Sparkles, ListChecks, PlusCircle, Trash2, BarChartHorizontal, Download, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const ACCEPTABLE_FILE_EXTENSIONS = ".pdf";

const backlogItemFormSchema = z.object({
  id: z.string(),
  featureName: z.string().min(1, "Название фичи обязательно."),
  description: z.string().optional(),
  userStory: z.string().optional(),
  impact: z.coerce.number().min(1).max(10).default(5),
  confidence: z.coerce.number().min(1).max(10).default(5),
  ease: z.coerce.number().min(1).max(10).default(5),
  iceScore: z.number().default(0),
});

type BacklogItemFormValues = z.infer<typeof backlogItemFormSchema>;

const formSchema = z.object({
  backlogItems: z.array(backlogItemFormSchema),
});

type FormValues = z.infer<typeof formSchema>;

export default function BrainstormBacklogCreator() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      backlogItems: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'backlogItems',
  });

  const watchBacklogItems = form.watch('backlogItems');

  // Recalculate ICE score for a specific item when I, C, or E changes
  const handleIceValueChange = (index: number, fieldName: 'impact' | 'confidence' | 'ease', value: number | string) => {
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 1 || numericValue > 10) return;

    const currentItem = form.getValues(`backlogItems.${index}`);
    const updatedItem = { ...currentItem, [fieldName]: numericValue };
    const newIceScore = (updatedItem.impact || 1) * (updatedItem.confidence || 1) * (updatedItem.ease || 1);
    
    form.setValue(`backlogItems.${index}.${fieldName}`, numericValue, { shouldValidate: true });
    form.setValue(`backlogItems.${index}.iceScore`, newIceScore);
  };
  
  const chartData = useMemo(() => {
    return watchBacklogItems
      .map(item => ({
        name: item.featureName,
        iceScore: item.iceScore,
      }))
      .sort((a, b) => b.iceScore - a.iceScore) // Sort descending by ICE score
      .slice(0, 15); // Show top 15
  }, [watchBacklogItems]);

  const chartConfig = {
    iceScore: {
      label: "ICE Score",
      color: "hsl(var(--chart-1))",
    },
  } satisfies Parameters<typeof ChartContainer>[0]["config"];


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({ title: 'Неверный формат файла', description: 'Пожалуйста, загрузите PDF файл.', variant: 'destructive' });
        setFile(null); setFileDataUri(null);
        event.target.value = '';
        return;
      }
      setFile(selectedFile);
      form.reset({ backlogItems: [] }); // Reset form on new file
      setFileDataUri(null);

      const reader = new FileReader();
      reader.onloadend = () => setFileDataUri(reader.result as string);
      reader.onerror = () => {
        toast({ title: 'Ошибка чтения файла', variant: 'destructive' });
        setFile(null); setFileDataUri(null);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(null); setFileDataUri(null);
    }
  };

  const handleGenerateBacklog = async () => {
    if (!fileDataUri || !file) {
      toast({ title: 'Файл не выбран', description: 'Пожалуйста, загрузите PDF файл.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    form.reset({ backlogItems: [] });

    try {
      const result: GenerateBacklogOutput = await generateBacklogFromBrainstorm({
        documentDataUri: fileDataUri,
        fileName: file.name,
      });
      
      const itemsWithClientSideIce = result.backlogItems.map(item => ({
        ...item,
        id: item.id || nanoid(),
        impact: item.impact || 5, // Default values if AI doesn't provide
        confidence: item.confidence || 5,
        ease: item.ease || 5,
        iceScore: (item.impact || 5) * (item.confidence || 5) * (item.ease || 5)
      }));

      form.setValue('backlogItems', itemsWithClientSideIce);
      toast({ title: 'Бэклог успешно сгенерирован', description: 'Проверьте и при необходимости отредактируйте элементы.' });
    } catch (error) {
      console.error('Error generating backlog:', error);
      toast({ title: 'Ошибка генерации бэклога', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const addNewBacklogItem = () => {
    append({
      id: nanoid(),
      featureName: '',
      description: '',
      userStory: '',
      impact: 5,
      confidence: 5,
      ease: 5,
      iceScore: 5 * 5 * 5,
    });
  };

  const exportToCSV = () => {
    if (fields.length === 0) {
      toast({ title: "Нет данных для экспорта", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Название фичи", "Описание", "User Story", "Impact", "Confidence", "Ease", "ICE Score"];
    const rows = fields.map(item => [
      item.id,
      `"${(item.featureName || '').replace(/"/g, '""')}"`, // Ensure string and escape double quotes
      `"${(item.description || '').replace(/"/g, '""')}"`,
      `"${(item.userStory || '').replace(/"/g, '""')}"`,
      item.impact,
      item.confidence,
      item.ease,
      item.iceScore
    ]);

    const csvDataString = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    
    // Add UTF-8 BOM
    const bom = "\uFEFF";
    const csvContent = bom + csvDataString;

    const encodedUri = encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", "data:text/csv;charset=utf-8," + encodedUri);
    link.setAttribute("download", `бэклог_${file?.name.split('.')[0] || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Экспорт в CSV успешен" });
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileUp className="h-6 w-6 text-accent" />
            1. Загрузка документа брейншторма
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brainstorm-pdf-upload">Выберите PDF файл</Label>
            <Input
              id="brainstorm-pdf-upload"
              type="file"
              onChange={handleFileChange}
              accept={ACCEPTABLE_FILE_EXTENSIONS}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
              disabled={isLoading}
            />
            {file && <p className="text-xs text-muted-foreground mt-1">Выбран файл: {file.name}</p>}
          </div>
          <Button onClick={handleGenerateBacklog} disabled={isLoading || !fileDataUri} className="w-full text-base py-3">
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Сгенерировать бэклог
          </Button>
        </CardContent>
      </Card>

      {isLoading && fields.length === 0 && (
        <Card className="mt-4 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-md text-muted-foreground">AI анализирует ваш документ и генерирует бэклог... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {fields.length > 0 && (
        <Card className="shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              <div className="flex items-center gap-2">
                <ListChecks className="h-6 w-6 text-accent" />
                2. Редактируемый Бэклог ({fields.length} элементов)
              </div>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> Экспорт в CSV
              </Button>
            </CardTitle>
            <CardDescription>Проверьте, отредактируйте или добавьте элементы бэклога. ICE Score = Impact * Confidence * Ease.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Название фичи</TableHead>
                    <TableHead className="w-[250px]">Описание</TableHead>
                    <TableHead className="w-[250px]">User Story</TableHead>
                    <TableHead className="w-[80px] text-center">Impact</TableHead>
                    <TableHead className="w-[80px] text-center">Conf.</TableHead>
                    <TableHead className="w-[80px] text-center">Ease</TableHead>
                    <TableHead className="w-[90px] text-center">ICE</TableHead>
                    <TableHead className="w-[50px] text-center">Действ.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Controller
                          name={`backlogItems.${index}.featureName`}
                          control={form.control}
                          render={({ field }) => <Textarea {...field} rows={2} className="text-xs"/>}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`backlogItems.${index}.description`}
                          control={form.control}
                          render={({ field }) => <Textarea {...field} rows={2} className="text-xs"/>}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`backlogItems.${index}.userStory`}
                          control={form.control}
                          render={({ field }) => <Textarea {...field} rows={2} className="text-xs"/>}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`backlogItems.${index}.impact`}
                          control={form.control}
                          render={({ field }) => (
                            <Input type="number" min="1" max="10" {...field} 
                                   onChange={e => handleIceValueChange(index, 'impact', e.target.value)} 
                                   className="text-center text-xs p-1 h-8"/>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`backlogItems.${index}.confidence`}
                          control={form.control}
                          render={({ field }) => (
                            <Input type="number" min="1" max="10" {...field} 
                                   onChange={e => handleIceValueChange(index, 'confidence', e.target.value)}
                                   className="text-center text-xs p-1 h-8"/>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`backlogItems.${index}.ease`}
                          control={form.control}
                          render={({ field }) => (
                            <Input type="number" min="1" max="10" {...field} 
                                   onChange={e => handleIceValueChange(index, 'ease', e.target.value)}
                                   className="text-center text-xs p-1 h-8"/>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center font-semibold text-sm">
                        {watchBacklogItems[index]?.iceScore || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => remove(index)} title="Удалить элемент">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <Button onClick={addNewBacklogItem} variant="outline" className="mt-4 w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Добавить новый элемент бэклога
            </Button>
          </CardContent>
        </Card>
      )}
      
      {fields.length > 0 && (
        <Card className="shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChartHorizontal className="h-6 w-6 text-accent" />
              3. Визуализация Бэклога (Топ по ICE Score)
            </CardTitle>
            <CardDescription>Горизонтальный бар-чарт, показывающий элементы бэклога, отсортированные по ICE Score.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chartData} margin={{ right: 30, left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} interval={0} style={{ fontSize: '10px', whiteSpace: 'normal', wordBreak: 'break-word' }}/>
                        <Tooltip
                          content={<ChartTooltipContent hideLabel />}
                          cursor={{fill: 'hsl(var(--muted))'}}
                        />
                        <Legend content={<ChartLegendContent />} />
                        <Bar dataKey="iceScore" fill="var(--color-iceScore)" radius={4} />
                    </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px] border rounded-md bg-muted/50">
                <p className="text-muted-foreground">Нет данных для отображения графика.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {fields.length === 0 && !isLoading && file && (
         <Card className="mt-4 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500 mb-3" />
            <p className="text-md text-muted-foreground">Бэклог не был сгенерирован или пуст. Попробуйте еще раз или проверьте содержимое PDF файла.</p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

