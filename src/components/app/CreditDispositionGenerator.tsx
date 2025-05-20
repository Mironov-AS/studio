
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
// Import types, but not the schema object from the flow
import { generateCreditDisposition, type GenerateCreditDispositionInput, type GenerateCreditDispositionOutput, type CreditDispositionCardData } from '@/ai/flows/generate-credit-disposition-flow';
import { Loader2, FileUp, Sparkles, Download, FileArchive, Edit3, Save, Trash2, CalendarIcon } from 'lucide-react';
import { exportHtmlElementToPdf } from '@/lib/pdfUtils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Form, 
  FormControl,
  FormField, 
  FormItem,
  FormLabel,
} from "@/components/ui/form";


const ACCEPTABLE_FILE_EXTENSIONS = ".pdf";

const CreditDispositionCardSchema = z.object({
  statementNumber: z.string().optional().describe('Уникальный идентификатор заявки.'),
  statementDate: z.union([z.date(), z.string()]).optional().describe('Дата заявления (ГГГГ-ММ-ДД).'),
  borrowerName: z.string().optional().describe('Полное юридическое название заемщика.'),
  borrowerInn: z.string().optional().describe('ИНН заемщика.'),
  contractNumber: z.string().optional().describe('Номер подписанного кредитного договора.'),
  contractDate: z.union([z.date(), z.string()]).optional().describe('Дата подписания договора (ГГГГ-ММ-ДД).'),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия']).optional().describe('Тип кредита.'),
  limitCurrency: z.string().optional().describe('Валюта кредитного лимита (например, RUB, USD).'),
  contractAmount: z.number().optional().describe('Общая сумма кредита.'),
  borrowerAccountNumber: z.string().optional().describe('Банковский расчётный счёт заемщика.'),
  enterpriseCategory: z.enum(['Среднее', 'Малое', 'Микро']).optional().describe('Признак субъекта МСП.'),
  creditCommitteeDecision: z.boolean().optional().describe('Есть решение кредитного комитета (true/false).'),
  subsidyAgent: z.string().optional().describe('Организация, предоставляющая субсидии.'),
  notesAndSpecialConditions: z.string().optional().describe('Любые дополнительные замечания и особые условия.'),
  assetBusinessModel: z.enum(['Удерживать для продажи', 'Иное']).optional().describe('Оценка модели управления активом.'),
  marketTransaction: z.enum(['Да', 'Нет', 'Не применимо']).optional().describe('Определение рыночного характера операции.'),
  commissionRate: z.number().optional().describe('Размер комиссионных сборов (число).'),
  commissionPaymentSchedule: z.array(z.union([z.date(), z.string()])).optional().describe("Список дат оплаты комиссий (массив дат в формате ГГГГ-ММ-ДД)."),
  earlyRepaymentAllowed: z.boolean().optional().describe('Разрешено ли частичное/досрочное погашение (true/false).'),
  notificationPeriodDays: z.number().int().optional().describe('Количество дней для уведомления кредитора.'),
  earlyRepaymentMoratorium: z.boolean().optional().describe('Запрет на досрочное погашение (true/false).'),
  penaltyRate: z.number().optional().describe('Величина штрафа за просрочку платежа (в процентах, число).'),
  penaltyIndexation: z.boolean().optional().describe('Применяется ли увеличение размера неустойки (true/false).'),
  sublimits: z.array(z.number()).optional().describe('Массив сумм отдельных сублимитов.'),
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное']).optional().describe('Соответствие нормам Центрального банка.'),
  dispositionExecutorName: z.string().optional().describe('ФИО сотрудника, подготовившего распоряжение.'),
  authorizedSignatory: z.string().optional().describe('Лицо, имеющее полномочия подписи (ФИО).'),
});

type FormValues = z.infer<typeof CreditDispositionCardSchema>; 

export default function CreditDispositionGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<GenerateCreditDispositionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(CreditDispositionCardSchema), 
    defaultValues: {
        sublimits: [],
        commissionPaymentSchedule: [],
    },
  });

  useEffect(() => {
    if (extractedData) {
      const rawDataFromAI = extractedData.dispositionCard;
      const processedFormData: Partial<FormValues> = {};

      const parseDateSafe = (dateInput: any): Date | undefined => {
        if (!dateInput) return undefined;
        if (dateInput instanceof Date && isValid(dateInput)) return dateInput;
        
        if (typeof dateInput === 'string') {
          let date = parseISO(dateInput); 
          if (isValid(date)) return date;

          date = parse(dateInput, 'dd.MM.yyyy', new Date());
          if (isValid(date)) return date;
          
           date = parse(dateInput, 'yyyy-MM-dd', new Date());
           if (isValid(date)) return date;

          toast({
            title: "Предупреждение о формате даты",
            description: `Не удалось распознать дату "${dateInput}". Пожалуйста, выберите дату вручную.`,
            variant: "default",
          });
          return undefined;
        }
        return undefined; 
      };
      
      (Object.keys(rawDataFromAI) as Array<keyof CreditDispositionCardData>).forEach(key => {
        const value = rawDataFromAI[key];
        if (key === 'statementDate' || key === 'contractDate') {
          (processedFormData as any)[key] = parseDateSafe(value);
        } else if (key === 'commissionPaymentSchedule' && Array.isArray(value)) {
          (processedFormData as any)[key] = value.map(d => parseDateSafe(d)).filter(Boolean); 
        } else if (['contractAmount', 'commissionRate', 'notificationPeriodDays', 'penaltyRate'].includes(key)) {
            if (value === null || value === undefined || String(value).trim() === "") {
              (processedFormData as any)[key] = undefined;
            } else {
              const num = parseFloat(String(value));
              (processedFormData as any)[key] = isNaN(num) ? undefined : num;
            }
        } else if (key === 'sublimits' && Array.isArray(value)) {
            (processedFormData as any)[key] = value.map(v => {
                const num = parseFloat(String(v));
                return isNaN(num) ? null : num;
            }).filter(v => v !== null);
        }
        else {
          (processedFormData as any)[key] = value;
        }
      });

      form.reset(processedFormData as FormValues);
      setIsEditing(false);
    }
  }, [extractedData, form, toast]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({ title: 'Неверный формат файла', description: 'Пожалуйста, загрузите PDF файл.', variant: 'destructive' });
        return;
      }
      setFile(selectedFile);
      setExtractedData(null);
      form.reset({sublimits: [], commissionPaymentSchedule: []});
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

  const handleExtractData = async () => {
    if (!fileDataUri || !file) {
      toast({ title: 'Файл не выбран', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setExtractedData(null);
    form.reset({sublimits: [], commissionPaymentSchedule: []});
    try {
      const result: GenerateCreditDispositionOutput = await generateCreditDisposition({ documentDataUri: fileDataUri, fileName: file.name });
      setExtractedData(result);
      toast({ title: 'Данные успешно извлечены', description: 'Проверьте и при необходимости отредактируйте поля.' });
    } catch (error) {
      console.error('Error extracting disposition data:', error);
      toast({ title: 'Ошибка извлечения данных', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdits = () => {
    const currentValues = form.getValues();
    // Ensure sublimits is an array of numbers if sublimitsData was used for editing
    const sublimitsString = (currentValues as any).sublimitsData; // Assuming sublimitsData is the temp field name
    let parsedSublimits: number[] = [];
    if (typeof sublimitsString === 'string' && sublimitsString.trim() !== '') {
        parsedSublimits = sublimitsString.split(',')
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n));
    } else if (Array.isArray(currentValues.sublimits)) {
        parsedSublimits = currentValues.sublimits; // Already an array
    }


    setExtractedData(prev => {
        if (!prev) return null;
        const updatedCardData = {
            ...currentValues,
            sublimits: parsedSublimits, // Use the parsed array
        } as CreditDispositionCardData;
        delete (updatedCardData as any).sublimitsData; // Clean up temp field
        return { ...prev, dispositionCard: updatedCardData };
    });

    setIsEditing(false);
    toast({ title: 'Изменения сохранены (локально)', description: 'Теперь вы можете экспортировать данные.' });
  };

  const handleExportPdf = async () => {
    if (!extractedData?.dispositionCard) return;
    setIsLoading(true);
    try {
      const wasEditing = isEditing;
      if (wasEditing) setIsEditing(false); 
      await new Promise(resolve => setTimeout(resolve, 100)); 

      await exportHtmlElementToPdf('disposition-card-view', `Распоряжение_${extractedData.dispositionCard.contractNumber || 'бн'}`);
      toast({ title: 'Экспорт в PDF успешен' });
      
      if (wasEditing) setIsEditing(true); 
    } catch (e) {
      toast({ title: 'Ошибка экспорта PDF', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!extractedData?.dispositionCard) return;
    const dispositionCardForExport = { ...extractedData.dispositionCard };
     // Ensure sublimits is an array of numbers if it was edited as a string
     if (typeof (dispositionCardForExport as any).sublimitsData === 'string') {
        const sublimitsString = (dispositionCardForExport as any).sublimitsData;
        dispositionCardForExport.sublimits = sublimitsString.split(',')
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n));
        delete (dispositionCardForExport as any).sublimitsData;
    }


    const jsonString = JSON.stringify(dispositionCardForExport, (key, value) => {
      if (value && (key === "statementDate" || key === "contractDate") && value instanceof Date && isValid(value)) {
        return format(value, "yyyy-MM-dd");
      }
      if (value && key === "commissionPaymentSchedule" && Array.isArray(value)) {
        return value.map(d => d instanceof Date && isValid(d) ? format(d, "yyyy-MM-dd") : d);
      }
      return value;
    }, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Распоряжение_${extractedData.dispositionCard.contractNumber || 'бн'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Экспорт в JSON успешен' });
  };
  
  const renderFormField = (fieldName: keyof FormValues, label: string, type: "text" | "number" | "textarea" | "select" | "checkbox" | "date" | "dateArray" | "numberArrayAsString", options?: string[]) => {
    const readOnly = !isEditing;
    const commonInputClass = "bg-card read-only:bg-muted/30 read-only:border-transparent read-only:focus-visible:ring-0 read-only:cursor-default";

    return (
      <FormField
        control={form.control}
        name={fieldName}
        render={({ field }) => {
            let fieldValue = field.value;
            if (type === "text" || type === "textarea" || type === "numberArrayAsString") {
                if (type === "numberArrayAsString") {
                    fieldValue = Array.isArray(field.value) ? (field.value as number[]).join(', ') : "";
                } else {
                    fieldValue = field.value === undefined || field.value === null ? "" : field.value;
                }
            } else if (type === "number") {
                fieldValue = field.value === undefined || field.value === null ? "" : String(field.value);
            } else if (type === 'checkbox') {
                fieldValue = field.value === undefined || field.value === null ? false : field.value;
            }

            return (
            <FormItem className="mb-3">
                <Label htmlFor={fieldName as string} className="text-sm font-medium">{label}</Label>
                {type === 'textarea' ? (
                <Textarea id={fieldName as string} {...form.register(fieldName)} defaultValue={fieldValue as string} readOnly={readOnly} rows={3} className={cn("mt-1", commonInputClass)} />
                ) : type === 'numberArrayAsString' ? (
                  <Textarea 
                    id={fieldName as string} 
                    defaultValue={fieldValue as string}
                    readOnly={readOnly} 
                    rows={2} 
                    className={cn("mt-1", commonInputClass)}
                    placeholder={readOnly ? (fieldValue ? "" : "Нет данных") : "Введите суммы через запятую, например: 100, 200.50"}
                    onChange={(e) => {
                        if (!readOnly) {
                            const stringValues = e.target.value.split(',');
                            const numberValues = stringValues
                                .map(s => parseFloat(s.trim()))
                                .filter(n => !isNaN(n));
                            form.setValue(fieldName, numberValues as any, { shouldValidate: true });
                        }
                    }}
                    onBlur={() => { // Ensure value is committed correctly on blur for array type
                        if (!readOnly) {
                           const currentVal = form.getValues(fieldName);
                           if (typeof currentVal === 'string') { // if it was temporarily a string
                                const numberValues = (currentVal as string).split(',')
                                .map(s => parseFloat(s.trim()))
                                .filter(n => !isNaN(n));
                                form.setValue(fieldName, numberValues as any, { shouldValidate: true });
                           }
                        }
                    }}
                  />
                ) : type === 'select' && options ? (
                <Controller
                    control={form.control}
                    name={fieldName}
                    render={({ field: controllerField }) => (
                    <Select 
                        onValueChange={controllerField.onChange} 
                        value={controllerField.value as string || ""}
                        disabled={readOnly}
                    >
                        <SelectTrigger className={cn("mt-1 w-full", commonInputClass)}>
                        <SelectValue placeholder={`Выберите ${label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                        {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    )}
                />
                ) : type === 'checkbox' ? (
                 <div className="mt-1 flex items-center h-10">
                    <Checkbox 
                        id={fieldName as string} 
                        checked={fieldValue as boolean} 
                        onCheckedChange={field.onChange} 
                        disabled={readOnly}
                        className={readOnly ? "cursor-default" : ""}
                    />
                 </div>
                ) : type === 'date' ? (
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground", commonInputClass)}
                        disabled={readOnly}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value instanceof Date && isValid(field.value)
                            ? format(field.value, "dd.MM.yyyy", { locale: ru })
                            : <span>Выберите дату</span>
                        }
                    </Button>
                    </PopoverTrigger>
                    {!readOnly && (
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={field.value instanceof Date && isValid(field.value) ? field.value : undefined}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ru}
                        />
                        </PopoverContent>
                    )}
                </Popover>
                ) : type === 'dateArray' ? (
                     <div className="mt-1 space-y-2">
                        {(field.value as any[] || []).map((dateItem, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input 
                                    type="text" 
                                    value={dateItem instanceof Date && isValid(dateItem) ? format(dateItem, "dd.MM.yyyy") : ''} 
                                    readOnly 
                                    className={cn("flex-grow", commonInputClass)}
                                />
                                {!readOnly && (
                                     <Button type="button" variant="ghost" size="icon" onClick={() => {
                                        const currentDates = Array.isArray(field.value) ? [...field.value] : [];
                                        currentDates.splice(index, 1);
                                        field.onChange(currentDates);
                                    }}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                )}
                            </div>
                        ))}
                        {!readOnly && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" className="w-full text-xs">Добавить дату</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        onSelect={(selectedDate) => {
                                            if (selectedDate) {
                                                const currentDates = Array.isArray(field.value) ? [...field.value] : [];
                                                field.onChange([...currentDates, selectedDate]);
                                            }
                                        }}
                                        locale={ru}
                                    />
                                </PopoverContent>
                            </Popover>
                        )}
                     </div>
                ) : (
                <Input id={fieldName as string} type={type === 'number' ? 'number' : 'text'} {...form.register(fieldName, { valueAsNumber: type === 'number' })} defaultValue={fieldValue as any} readOnly={readOnly} className={cn("mt-1", commonInputClass)} />
                )}
                <p className="text-xs text-destructive">{form.formState.errors[fieldName as keyof FormValues]?.message as string}</p>
            </FormItem>
            );
        }}
        />
    );
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <FileArchive className="h-8 w-8 text-accent" />
            Распоряжение о постановке на учет (Кредитные договоры)
          </CardTitle>
          <CardDescription>
            Загрузите PDF-файл кредитного договора. Система извлечет ключевые данные для формирования проекта распоряжения.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credit-agreement-upload" className="font-medium">Загрузить кредитный договор (PDF)</Label>
            <Input
              id="credit-agreement-upload"
              type="file"
              onChange={handleFileChange}
              accept={ACCEPTABLE_FILE_EXTENSIONS}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
            />
            {file && <p className="text-xs text-muted-foreground mt-1">Выбран файл: {file.name}</p>}
          </div>
          <Button onClick={handleExtractData} disabled={isLoading || !fileDataUri} className="w-full text-base py-3">
            {isLoading && extractedData === null ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Извлечь данные из договора
          </Button>
        </CardContent>
      </Card>

      {isLoading && !extractedData && (
        <Card className="mt-4 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-md text-muted-foreground">AI анализирует документ...</p>
          </CardContent>
        </Card>
      )}

      {extractedData && (
        <Form {...form}> 
          <form onSubmit={form.handleSubmit(handleSaveEdits)}>
            <Card id="disposition-card-view" className="mt-4 shadow-xl rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle className="text-xl">Проект распоряжения</CardTitle>
                      <CardDescription>Проверьте и при необходимости отредактируйте извлеченные данные.</CardDescription>
                  </div>
                  {!isEditing ? (
                      <Button type="button" variant="outline" onClick={() => setIsEditing(true)} disabled={isLoading}>
                          <Edit3 className="mr-2 h-4 w-4" /> Редактировать
                      </Button>
                  ) : (
                      <Button type="submit" variant="default" disabled={isLoading}>
                          <Save className="mr-2 h-4 w-4" /> Сохранить изменения
                      </Button>
                  )}
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5">
                {renderFormField('statementNumber', 'Номер заявления', 'text')}
                {renderFormField('statementDate', 'Дата заявления', 'date')}
                {renderFormField('borrowerName', 'Название заемщика', 'text')}
                {renderFormField('borrowerInn', 'ИНН заемщика', 'text')}
                {renderFormField('contractNumber', 'Номер договора', 'text')}
                {renderFormField('contractDate', 'Дата договора', 'date')}
                {renderFormField('creditType', 'Вид кредитования', 'select', ['Кредитная линия', 'Возобновляемая кредитная линия'])}
                {renderFormField('limitCurrency', 'Валюта лимита', 'text')}
                {renderFormField('contractAmount', 'Сумма договора', 'number')}
                {renderFormField('borrowerAccountNumber', 'Расчётный счёт заемщика', 'text')}
                {renderFormField('enterpriseCategory', 'Категория предприятия', 'select', ['Среднее', 'Малое', 'Микро'])}
                {renderFormField('creditCommitteeDecision', 'Решение кредитного комитета', 'checkbox')}
                {renderFormField('subsidyAgent', 'Агент субсидии', 'text')}
                {renderFormField('notesAndSpecialConditions', 'Примечания и особые условия', 'textarea')}
                {renderFormField('assetBusinessModel', 'Бизнес-модель активов', 'select', ['Удерживать для продажи', 'Иное'])}
                {renderFormField('marketTransaction', 'Рыночность сделки', 'select', ['Да', 'Нет', 'Не применимо'])}
                {renderFormField('commissionRate', 'Размер комиссии', 'number')}
                {renderFormField('commissionPaymentSchedule', 'График оплат комиссий', 'dateArray')}
                {renderFormField('earlyRepaymentAllowed', 'Допускается досрочная оплата', 'checkbox')}
                {renderFormField('notificationPeriodDays', 'Срок уведомления (дней)', 'number')}
                {renderFormField('earlyRepaymentMoratorium', 'Мораторий на досрочную оплату', 'checkbox')}
                {renderFormField('penaltyRate', 'Уровень штрафных санкций (%)', 'number')}
                {renderFormField('penaltyIndexation', 'Индексация размера неустойки', 'checkbox')}
                {renderFormField('sublimits', 'Сублимиты (суммы через запятую)', 'numberArrayAsString')}
                {renderFormField('finalCreditQualityCategory', 'Итоговая категория качества кредита', 'select', ['Хорошее', 'Проблемное', 'Просроченное'])}
                {renderFormField('dispositionExecutorName', 'Исполнитель распоряжения (ФИО)', 'text')}
                {renderFormField('authorizedSignatory', 'Авторизованное лицо (ФИО)', 'text')}
              </CardContent>
              <CardFooter className="mt-4 pt-4 border-t flex flex-col sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleExportJson} disabled={isLoading || isEditing}>
                      <Download className="mr-2 h-4 w-4" /> Экспорт в JSON
                  </Button>
                  <Button type="button" variant="outline" onClick={handleExportPdf} disabled={isLoading || isEditing}>
                      {isLoading && !fileDataUri && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                      <Download className="mr-2 h-4 w-4" /> Экспорт в PDF
                  </Button>
              </CardFooter>
            </Card>
          </form>
        </Form> 
      )}
    </div>
  );
}
