
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
import { generateCreditDisposition, type GenerateCreditDispositionInput, type GenerateCreditDispositionOutput, type CreditDispositionCardData, type SublimitDetail } from '@/ai/flows/generate-credit-disposition-flow';
import { Loader2, FileUp, Sparkles, Download, FileArchive, Edit3, Save, Trash2, CalendarIcon, PackageOpen, CircleDollarSign, TrendingDown, ShieldAlert, Info, BookOpen, Users2 } from 'lucide-react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


const ACCEPTABLE_FILE_EXTENSIONS = ".pdf";

// Schema for individual sublimit details - must match the one in the flow
const SublimitDetailSchema = z.object({
  sublimitAmount: z.number().optional().describe("Сумма сублимита."),
  sublimitCurrency: z.string().optional().describe("Валюта сублимита."),
  sublimitAvailabilityPeriod: z.string().optional().describe("Период доступности сублимита."),
  sublimitExpiryDate: z.union([z.date(), z.string()]).optional().describe("Дата завершения действия сублимита (ГГГГ-ММ-ДД)."),
  sublimitPurpose: z.string().optional().describe("Цели, на которые выделялся сублимит."),
  sublimitInvestmentPhase: z.string().optional().describe("Инвестиционная фаза сублимита."),
  sublimitRepaymentOrder: z.string().optional().describe("Особенности порядка погашения задолженности по сублимиту."),
});

// Zod schema for form validation - This must match the schema in generate-credit-disposition-flow.ts
const CreditDispositionCardZodSchema = z.object({
  statementNumber: z.string().optional(),
  statementDate: z.union([z.date(), z.string().optional()]).optional(),
  borrowerName: z.string().optional(),
  borrowerInn: z.string().optional(),
  contractNumber: z.string().optional(),
  contractDate: z.union([z.date(), z.string().optional()]).optional(),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия']).optional(),
  limitCurrency: z.string().optional(),
  contractAmount: z.number().optional().nullable(),
  bankUnitCode: z.string().optional(),
  contractTerm: z.string().optional(),
  borrowerAccountNumber: z.string().optional(),
  enterpriseCategory: z.enum(['Среднее', 'Малое', 'Микро', 'Не применимо']).optional(),
  creditCommitteeDecisionDetails: z.string().optional(),
  subsidyAgent: z.string().optional(),
  generalNotesAndSpecialConditions: z.string().optional(),
  sppiTestResult: z.string().optional(),
  assetOwnershipBusinessModel: z.enum(['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное']).optional(),
  marketTransactionAssessment: z.enum(['Рыночная', 'Нерыночная', 'Не удалось определить']).optional(),
  commissionType: z.enum(["Фиксированная", "Переменная", "Отсутствует", "Комбинированная"]).optional(),
  commissionCalculationMethod: z.string().optional(),
  commissionPaymentSchedule: z.array(z.union([z.date(), z.string()])).optional(),
  earlyRepaymentConditions: z.object({
    mandatoryEarlyRepaymentAllowed: z.boolean().optional(),
    voluntaryEarlyRepaymentAllowed: z.boolean().optional(),
    earlyRepaymentFundingSources: z.string().optional(),
    earlyRepaymentCommissionRate: z.number().optional().nullable(),
    principalAndInterestRepaymentOrder: z.string().optional(),
    earlyRepaymentMoratoriumDetails: z.string().optional().describe("Ограничительные моратории на возможность досрочно погасить долг (описание условий или \"Отсутствует\")."),
  }).optional(),
  penaltySanctions: z.object({
    latePrincipalPaymentPenalty: z.string().optional(),
    lateInterestPaymentPenalty: z.string().optional(),
    lateCommissionPaymentPenalty: z.string().optional(),
    penaltyIndexation: z.boolean().optional(),
  }).optional(),
  sublimitDetails: z.array(SublimitDetailSchema).optional(),
  financialIndicatorsAndCalculations: z.object({
    accruedInterestRate: z.number().optional().nullable(),
    capitalizedInterestRate: z.number().optional().nullable(),
    accruedInterestCalculationRules: z.string().optional(),
    interestPaymentRegulations: z.string().optional(),
    debtAndCommissionReservingParams: z.string().optional(),
    insuranceProductCodes: z.string().optional(),
    specialContractConditions: z.string().optional(),
  }).optional(),
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное', 'Не определена']).optional(),
  dispositionExecutorName: z.string().optional(),
  authorizedSignatory: z.string().optional(),
  // Temporary field for editing sublimitDetails as JSON
  sublimitDetailsJson: z.string().optional(),
});

type FormValues = z.infer<typeof CreditDispositionCardZodSchema>; 

export default function CreditDispositionGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<GenerateCreditDispositionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(CreditDispositionCardZodSchema), 
    defaultValues: {
        commissionPaymentSchedule: [],
        sublimitDetails: [],
        sublimitDetailsJson: "[]",
        earlyRepaymentConditions: {},
        penaltySanctions: {},
        financialIndicatorsAndCalculations: {},
    },
  });

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

      console.warn(`Не удалось распознать дату "${dateInput}".`);
      // toast({ // This can be too noisy if AI often returns unparsed dates.
      //   title: "Предупреждение о формате даты",
      //   description: `Не удалось распознать дату "${dateInput}". Пожалуйста, выберите дату вручную.`,
      //   variant: "default",
      // });
      return undefined;
    }
    return undefined; 
  };

  useEffect(() => {
    if (extractedData?.dispositionCard) {
      const rawDataFromAI = extractedData.dispositionCard;
      const processedFormData: Partial<FormValues> = {};

      (Object.keys(rawDataFromAI) as Array<keyof CreditDispositionCardData>).forEach(key => {
        const value = rawDataFromAI[key];
        if (key === 'statementDate' || key === 'contractDate') {
          (processedFormData as any)[key] = parseDateSafe(value);
        } else if (key === 'commissionPaymentSchedule' && Array.isArray(value)) {
          (processedFormData as any)[key] = value.map(d => parseDateSafe(d)).filter(d => d instanceof Date && isValid(d)); 
        } else if (key === 'sublimitDetails' && Array.isArray(value)) {
            const parsedSublimits = value.map(sl => ({
                ...sl,
                sublimitExpiryDate: parseDateSafe(sl.sublimitExpiryDate)
            }));
            (processedFormData as any)[key] = parsedSublimits;
            (processedFormData as any).sublimitDetailsJson = JSON.stringify(parsedSublimits, null, 2);
        } else if (['contractAmount', 'earlyRepaymentConditions.earlyRepaymentCommissionRate', 'financialIndicatorsAndCalculations.accruedInterestRate', 'financialIndicatorsAndCalculations.capitalizedInterestRate'].includes(key) || (key.startsWith('sublimitDetails[') && key.endsWith('].sublimitAmount'))) {
            // Handling nested number fields will be more complex here, direct mapping for top-level
            if (key === 'contractAmount' || key === 'earlyRepaymentConditions.earlyRepaymentCommissionRate' || key === 'financialIndicatorsAndCalculations.accruedInterestRate' || key === 'financialIndicatorsAndCalculations.capitalizedInterestRate') {
                if (value === null || value === undefined || String(value).trim() === "") {
                (processedFormData as any)[key] = null; // Use null for optional numbers to clear them
                } else {
                const num = parseFloat(String(value));
                (processedFormData as any)[key] = isNaN(num) ? null : num;
                }
            } else {
                 (processedFormData as any)[key] = value;
            }
        } else if (key === 'earlyRepaymentConditions' || key === 'penaltySanctions' || key === 'financialIndicatorsAndCalculations') {
            // For object fields, ensure they are at least empty objects if null/undefined from AI
            (processedFormData as any)[key] = value && typeof value === 'object' ? value : {};
             if (key === 'earlyRepaymentConditions' && value) {
                processedFormData.earlyRepaymentConditions!.earlyRepaymentCommissionRate = 
                    (value as any).earlyRepaymentCommissionRate === null || (value as any).earlyRepaymentCommissionRate === undefined || String((value as any).earlyRepaymentCommissionRate).trim() === ""
                    ? null
                    : (isNaN(parseFloat(String((value as any).earlyRepaymentCommissionRate))) ? null : parseFloat(String((value as any).earlyRepaymentCommissionRate)));
             }
              if (key === 'financialIndicatorsAndCalculations' && value) {
                const finCalculations = value as any;
                processedFormData.financialIndicatorsAndCalculations!.accruedInterestRate = 
                    finCalculations.accruedInterestRate === null || finCalculations.accruedInterestRate === undefined || String(finCalculations.accruedInterestRate).trim() === ""
                    ? null
                    : (isNaN(parseFloat(String(finCalculations.accruedInterestRate))) ? null : parseFloat(String(finCalculations.accruedInterestRate)));
                processedFormData.financialIndicatorsAndCalculations!.capitalizedInterestRate =
                    finCalculations.capitalizedInterestRate === null || finCalculations.capitalizedInterestRate === undefined || String(finCalculations.capitalizedInterestRate).trim() === ""
                    ? null
                    : (isNaN(parseFloat(String(finCalculations.capitalizedInterestRate))) ? null : parseFloat(String(finCalculations.capitalizedInterestRate)));
             }


        } else {
          (processedFormData as any)[key] = value;
        }
      });
      
      // Ensure nested objects are initialized if not present from AI
      processedFormData.earlyRepaymentConditions = processedFormData.earlyRepaymentConditions || {};
      processedFormData.penaltySanctions = processedFormData.penaltySanctions || {};
      processedFormData.financialIndicatorsAndCalculations = processedFormData.financialIndicatorsAndCalculations || {};


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
      form.reset({
        commissionPaymentSchedule: [], 
        sublimitDetails: [], 
        sublimitDetailsJson: "[]",
        earlyRepaymentConditions: {},
        penaltySanctions: {},
        financialIndicatorsAndCalculations: {},
      });
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
    form.reset({
        commissionPaymentSchedule: [], 
        sublimitDetails: [], 
        sublimitDetailsJson: "[]",
        earlyRepaymentConditions: {},
        penaltySanctions: {},
        financialIndicatorsAndCalculations: {},
    });
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

 const handleSaveEdits = (values: FormValues) => {
    let parsedSublimitDetails: SublimitDetail[] = [];
    if (values.sublimitDetailsJson) {
      try {
        parsedSublimitDetails = JSON.parse(values.sublimitDetailsJson);
        if (!Array.isArray(parsedSublimitDetails)) throw new Error("JSON не является массивом");
        // Further validation for each object in parsedSublimitDetails can be added here if needed
         parsedSublimitDetails = parsedSublimitDetails.map(sl => ({
            ...sl,
            sublimitExpiryDate: parseDateSafe(sl.sublimitExpiryDate) as any // Keep as Date or string
        }));

      } catch (e) {
        toast({ title: 'Ошибка JSON в сублимитах', description: `Некорректный формат JSON: ${(e as Error).message}. Изменения для сублимитов не сохранены.`, variant: 'destructive' });
        // Optionally, revert sublimitDetailsJson to its previous valid state or keep the invalid one for user to fix
        parsedSublimitDetails = form.getValues('sublimitDetails') || []; // Revert to old value if parse fails
      }
    }

    setExtractedData(prev => {
        if (!prev) return null;
        const updatedCardData = {
            ...values, // get all values from the form
            sublimitDetails: parsedSublimitDetails, // use parsed/validated sublimitDetails
        } as CreditDispositionCardData;
        delete (updatedCardData as any).sublimitDetailsJson; // Remove the temporary JSON string field

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
    
    let dataToExport = { ...extractedData.dispositionCard };

    // If sublimitDetailsJson was used for editing, parse it for export
    const currentFormValues = form.getValues();
    if (currentFormValues.sublimitDetailsJson) {
        try {
            const parsedSublimits = JSON.parse(currentFormValues.sublimitDetailsJson);
            if (Array.isArray(parsedSublimits)) {
                dataToExport.sublimitDetails = parsedSublimits.map(sl => ({
                    ...sl,
                    // Format dates within sublimits if they are Date objects
                    sublimitExpiryDate: sl.sublimitExpiryDate instanceof Date && isValid(sl.sublimitExpiryDate)
                        ? format(sl.sublimitExpiryDate, "yyyy-MM-dd")
                        : sl.sublimitExpiryDate 
                }));
            }
        } catch (e) {
            // If JSON is invalid, export the potentially unparsed data or an empty array
            console.warn("Invalid JSON in sublimitDetailsJson during export, exporting current form value for sublimitDetails if available.");
            dataToExport.sublimitDetails = form.getValues('sublimitDetails') || [];
        }
    }
    delete (dataToExport as any).sublimitDetailsJson;


    const jsonString = JSON.stringify(dataToExport, (key, value) => {
      if (value && (key === "statementDate" || key === "contractDate") && value instanceof Date && isValid(value)) {
        return format(value, "yyyy-MM-dd");
      }
      if (value && key === "commissionPaymentSchedule" && Array.isArray(value)) {
        return value.map(d => d instanceof Date && isValid(d) ? format(d, "yyyy-MM-dd") : d);
      }
      // Ensure dates within sublimitDetails are also formatted if they are Date objects (already handled above)
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
  
  const renderFormField = (
    fieldName: keyof FormValues, 
    label: string, 
    type: "text" | "number" | "textarea" | "select" | "checkbox" | "date" | "dateArray" | "objectArrayAsJsonString", 
    options?: string[],
    description?: string
  ) => {
    const readOnly = !isEditing;
    const commonInputClass = "bg-card read-only:bg-muted/30 read-only:border-transparent read-only:focus-visible:ring-0 read-only:cursor-default";

    return (
      <FormField
        control={form.control}
        name={fieldName}
        render={({ field }) => {
            let fieldValue = field.value;
             if (type === "text" || type === "textarea") {
                fieldValue = field.value === undefined || field.value === null ? "" : field.value;
            } else if (type === "number") {
                fieldValue = field.value === undefined || field.value === null || field.value === "" ? "" : String(field.value);
            } else if (type === 'checkbox') {
                fieldValue = field.value === undefined || field.value === null ? false : field.value;
            } else if (type === 'objectArrayAsJsonString') {
                 // For editing 'sublimitDetailsJson', the value is already a string
                 // For display, we use 'sublimitDetails' which is an array of objects
                if (readOnly) {
                    const actualArray = form.getValues(fieldName.replace('Json', '') as keyof FormValues);
                    fieldValue = Array.isArray(actualArray) ? JSON.stringify(actualArray, null, 2) : "[]";
                } else {
                    fieldValue = field.value === undefined || field.value === null ? "[]" : field.value;
                }
            }


            return (
            <FormItem className="mb-3 flex flex-col">
                <Label htmlFor={fieldName as string} className="text-sm font-medium mb-1">{label}</Label>
                {type === 'textarea' || type === 'objectArrayAsJsonString' ? (
                <Textarea 
                    id={fieldName as string} 
                    {...form.register(fieldName)} 
                    defaultValue={fieldValue as string} 
                    readOnly={readOnly} 
                    rows={type === 'objectArrayAsJsonString' ? 5 : 3} 
                    className={cn("mt-0.5", commonInputClass, type === 'objectArrayAsJsonString' && 'font-mono text-xs')} 
                    placeholder={type === 'objectArrayAsJsonString' && !readOnly ? 'Введите массив объектов в формате JSON...' : (readOnly && !fieldValue ? 'Нет данных' : undefined)}
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
                        <SelectTrigger className={cn("mt-0.5 w-full", commonInputClass)}>
                        <SelectValue placeholder={`Выберите ${label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                        {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    )}
                />
                ) : type === 'checkbox' ? (
                 <div className="mt-0.5 flex items-center h-10">
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
                        className={cn("w-full justify-start text-left font-normal mt-0.5", !(field.value instanceof Date && isValid(field.value)) && "text-muted-foreground", commonInputClass)}
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
                            onSelect={date => field.onChange(date)}
                            initialFocus
                            locale={ru}
                        />
                        </PopoverContent>
                    )}
                </Popover>
                ) : type === 'dateArray' ? (
                     <div className="mt-0.5 space-y-2">
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
                        {!(field.value && (field.value as any[]).length > 0) && readOnly && <Input readOnly value="Нет данных" className={commonInputClass} />}
                        {!readOnly && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" className="w-full text-xs">Добавить дату в график</Button>
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
                ) : ( // text or number
                <Input 
                    id={fieldName as string} 
                    type={type === 'number' ? 'number' : 'text'} 
                    step={type === 'number' ? 'any' : undefined}
                    {...form.register(fieldName, { valueAsNumber: type === 'number' })} 
                    defaultValue={fieldValue as any} 
                    readOnly={readOnly} 
                    className={cn("mt-0.5", commonInputClass)} 
                    placeholder={readOnly && !fieldValue ? 'Нет данных' : undefined}
                />
                )}
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                <p className="text-xs text-destructive h-3">{form.formState.errors[fieldName as keyof FormValues]?.message as string || (form.formState.errors as any)[fieldName]?.root?.message as string}</p>
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
              <CardHeader className="flex flex-row items-center justify-between pb-4">
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
              <CardContent className="pt-2">
                <Accordion type="multiple" defaultValue={['general', 'msfo', 'commission', 'repayment', 'penalties', 'sublimits', 'financial', 'admin']} className="w-full">
                  <AccordionItem value="general">
                    <AccordionTrigger className="text-lg hover:no-underline"><Info className="mr-2 h-5 w-5 text-primary" />Общие элементы</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField('statementNumber', 'Номер заявления', 'text')}
                      {renderFormField('statementDate', 'Дата заявления', 'date')}
                      {renderFormField('borrowerName', 'Название заемщика', 'text')}
                      {renderFormField('borrowerInn', 'ИНН заемщика', 'text')}
                      {renderFormField('contractNumber', 'Номер договора', 'text')}
                      {renderFormField('contractDate', 'Дата договора', 'date')}
                      {renderFormField('creditType', 'Вид кредитования', 'select', ['Кредитная линия', 'Возобновляемая кредитная линия'])}
                      {renderFormField('limitCurrency', 'Валюта лимита/договора', 'text')}
                      {renderFormField('contractAmount', 'Сумма договора', 'number')}
                      {renderFormField('bankUnitCode', 'Код подразделения банка', 'text')}
                      {renderFormField('contractTerm', 'Срок действия договора', 'text')}
                      {renderFormField('borrowerAccountNumber', 'Расчётный счёт заемщика', 'text')}
                      {renderFormField('enterpriseCategory', 'Категория предприятия', 'select', ['Среднее', 'Малое', 'Микро', 'Не применимо'])}
                      {renderFormField('creditCommitteeDecisionDetails', 'Решение кредитного комитета (детали)', 'text')}
                      {renderFormField('subsidyAgent', 'Агент субсидии', 'text')}
                      {renderFormField('generalNotesAndSpecialConditions', 'Общие примечания и особые условия', 'textarea')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="msfo">
                    <AccordionTrigger className="text-lg hover:no-underline"><BookOpen className="mr-2 h-5 w-5 text-primary" />МСФО</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField('sppiTestResult', 'Результат SPPI-теста', 'text')}
                      {renderFormField('assetOwnershipBusinessModel', 'Бизнес-модель владения активом', 'select', ['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное'])}
                      {renderFormField('marketTransactionAssessment', 'Оценка рыночности сделки', 'select', ['Рыночная', 'Нерыночная', 'Не удалось определить'])}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="commission">
                    <AccordionTrigger className="text-lg hover:no-underline"><CircleDollarSign className="mr-2 h-5 w-5 text-primary" />Комиссионные сборы</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField('commissionType', 'Вид комиссии', 'select', ["Фиксированная", "Переменная", "Отсутствует", "Комбинированная"])}
                      {renderFormField('commissionCalculationMethod', 'Порядок расчета комиссий', 'textarea')}
                      {renderFormField('commissionPaymentSchedule', 'График оплат комиссий', 'dateArray')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="repayment">
                    <AccordionTrigger className="text-lg hover:no-underline"><TrendingDown className="mr-2 h-5 w-5 text-primary" />Условия досрочного погашения</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                        {renderFormField('earlyRepaymentConditions.mandatoryEarlyRepaymentAllowed', 'Обязательное досрочное погашение разрешено', 'checkbox')}
                        {renderFormField('earlyRepaymentConditions.voluntaryEarlyRepaymentAllowed', 'Добровольное досрочное погашение разрешено', 'checkbox')}
                        {renderFormField('earlyRepaymentConditions.earlyRepaymentFundingSources', 'Источники финансирования досрочных выплат', 'textarea')}
                        {renderFormField('earlyRepaymentConditions.earlyRepaymentCommissionRate', 'Комиссия за досрочные выплаты (%)', 'number')}
                        {renderFormField('earlyRepaymentConditions.principalAndInterestRepaymentOrder', 'Очередность погашения ОД и процентов', 'textarea')}
                        {renderFormField('earlyRepaymentConditions.earlyRepaymentMoratoriumDetails', 'Мораторий на досрочное погашение (детали)', 'textarea')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="penalties">
                    <AccordionTrigger className="text-lg hover:no-underline"><ShieldAlert className="mr-2 h-5 w-5 text-primary" />Штрафные санкции</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                        {renderFormField('penaltySanctions.latePrincipalPaymentPenalty', 'Штраф за просрочку ОД', 'text')}
                        {renderFormField('penaltySanctions.lateInterestPaymentPenalty', 'Штраф за просрочку процентов', 'text')}
                        {renderFormField('penaltySanctions.lateCommissionPaymentPenalty', 'Штраф за неоплату комиссий', 'text')}
                        {renderFormField('penaltySanctions.penaltyIndexation', 'Индексация неустойки', 'checkbox')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="sublimits">
                    <AccordionTrigger className="text-lg hover:no-underline"><PackageOpen className="mr-2 h-5 w-5 text-primary" />Информация по сублимитам</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {renderFormField('sublimitDetailsJson', 'Сублимиты (массив объектов JSON)', 'objectArrayAsJsonString', [], "Отредактируйте как массив JSON. Каждый объект должен соответствовать схеме SublimitDetail.")}
                    </AccordionContent>
                  </AccordionItem>
                   <AccordionItem value="financial">
                    <AccordionTrigger className="text-lg hover:no-underline"><CircleDollarSign className="mr-2 h-5 w-5 text-primary" />Финансовые показатели и расчеты</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                        {renderFormField('financialIndicatorsAndCalculations.accruedInterestRate', 'Ставка начисленных процентов (%)', 'number')}
                        {renderFormField('financialIndicatorsAndCalculations.capitalizedInterestRate', 'Ставка капитализированных процентов (%)', 'number')}
                        {renderFormField('financialIndicatorsAndCalculations.accruedInterestCalculationRules', 'Правила расчета начисленных процентов', 'textarea')}
                        {renderFormField('financialIndicatorsAndCalculations.interestPaymentRegulations', 'Регламент уплаты процентов', 'textarea')}
                        {renderFormField('financialIndicatorsAndCalculations.debtAndCommissionReservingParams', 'Параметры резервирования', 'textarea')}
                        {renderFormField('financialIndicatorsAndCalculations.insuranceProductCodes', 'Коды страховых продуктов', 'text')}
                        {renderFormField('financialIndicatorsAndCalculations.specialContractConditions', 'Особые фин. условия договора', 'textarea')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="admin">
                    <AccordionTrigger className="text-lg hover:no-underline"><Users2 className="mr-2 h-5 w-5 text-primary" />Административные блоки</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField('finalCreditQualityCategory', 'Итоговая категория качества кредита', 'select', ['Хорошее', 'Проблемное', 'Просроченное', 'Не определена'])}
                      {renderFormField('dispositionExecutorName', 'Исполнитель распоряжения (ФИО)', 'text')}
                      {renderFormField('authorizedSignatory', 'Авторизованное лицо (ФИО)', 'text')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

