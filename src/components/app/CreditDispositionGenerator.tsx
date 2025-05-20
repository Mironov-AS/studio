
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
  sublimitAmount: z.number().optional().nullable().describe("Сумма сублимита."),
  sublimitCurrency: z.string().optional().describe("Валюта сублимита."),
  sublimitAvailabilityPeriod: z.string().optional().describe("Период доступности сублимита."),
  sublimitExpiryDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe("Дата завершения действия сублимита (ГГГГ-ММ-ДД)."),
  sublimitPurpose: z.string().optional().describe("Цели, на которые выделялся сублимит."),
  sublimitInvestmentPhase: z.string().optional().describe("Инвестиционная фаза сублимита."),
  sublimitRepaymentOrder: z.string().optional().describe("Особенности порядка погашения задолженности по сублимиту."),
});

// Zod schema for form validation - This must match the schema in generate-credit-disposition-flow.ts
const CreditDispositionCardZodSchema = z.object({
  statementNumber: z.string().optional(),
  statementDate: z.union([z.date().nullable(), z.string().optional()]).optional(),
  borrowerName: z.string().optional(),
  borrowerInn: z.string().optional(),
  contractNumber: z.string().optional(),
  contractDate: z.union([z.date().nullable(), z.string().optional()]).optional(),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия', '']).optional(),
  limitCurrency: z.string().optional(),
  contractAmount: z.number().optional().nullable(),
  bankUnitCode: z.string().optional(),
  contractTerm: z.string().optional(),
  borrowerAccountNumber: z.string().optional(),
  enterpriseCategory: z.enum(['Среднее', 'Малое', 'Микро', 'Не применимо', '']).optional(),
  creditCommitteeDecisionDetails: z.string().optional(),
  subsidyAgent: z.string().optional(),
  generalNotesAndSpecialConditions: z.string().optional(),
  sppiTestResult: z.string().optional(),
  assetOwnershipBusinessModel: z.enum(['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное', '']).optional(),
  marketTransactionAssessment: z.enum(['Рыночная', 'Нерыночная', 'Не удалось определить', '']).optional(),
  commissionType: z.enum(["Фиксированная", "Переменная", "Отсутствует", "Комбинированная", ""]).optional(),
  commissionCalculationMethod: z.string().optional(),
  commissionPaymentSchedule: z.array(z.union([z.date(), z.string()])).optional(),
  earlyRepaymentConditions: z.object({
    mandatoryEarlyRepaymentAllowed: z.boolean().optional(),
    voluntaryEarlyRepaymentAllowed: z.boolean().optional(),
    earlyRepaymentFundingSources: z.string().optional(),
    earlyRepaymentCommissionRate: z.number().optional().nullable(),
    principalAndInterestRepaymentOrder: z.string().optional(),
    earlyRepaymentMoratoriumDetails: z.string().optional().describe("Ограничительные моратории на возможность досрочно погасить долг (описание условий или \"Отсутствует\")."),
  }).optional().default({}),
  penaltySanctions: z.object({
    latePrincipalPaymentPenalty: z.string().optional(),
    lateInterestPaymentPenalty: z.string().optional(),
    lateCommissionPaymentPenalty: z.string().optional(),
    penaltyIndexation: z.boolean().optional(),
  }).optional().default({}),
  sublimitDetails: z.array(SublimitDetailSchema).optional().default([]),
  financialIndicatorsAndCalculations: z.object({
    accruedInterestRate: z.number().optional().nullable(),
    capitalizedInterestRate: z.number().optional().nullable(),
    accruedInterestCalculationRules: z.string().optional(),
    interestPaymentRegulations: z.string().optional(),
    debtAndCommissionReservingParams: z.string().optional(),
    insuranceProductCodes: z.string().optional(),
    specialContractConditions: z.string().optional(),
  }).optional().default({}),
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное', 'Не определена', '']).optional(),
  dispositionExecutorName: z.string().optional(),
  authorizedSignatory: z.string().optional(),
  // Temporary field for editing sublimitDetails as JSON
  sublimitDetailsJson: z.string().optional(),
});

type FormValues = z.infer<typeof CreditDispositionCardZodSchema>; 

// Helper function to format values for PDF display
const formatForDisplay = (value: any, type: 'date' | 'boolean' | 'currency' | 'percent' | 'string' | 'number' = 'string'): string => {
    if (value === undefined || value === null || String(value).trim() === '') {
        return 'Не указано';
    }
    if (type === 'date') {
        return value instanceof Date && isValid(value) ? format(value, "dd.MM.yyyy", { locale: ru }) : String(value);
    }
    if (type === 'boolean') {
        return value ? 'Да' : 'Нет';
    }
    if (type === 'currency' && typeof value === 'number') {
        return `${value.toLocaleString('ru-RU')} RUB`; // Assuming RUB, can be dynamic
    }
    if (type === 'percent' && typeof value === 'number') {
        return `${value}%`;
    }
    return String(value);
};


const renderPdfHtml = (data: FormValues): string => {
    let html = `<div id="pdf-render-content-inner" style="font-family: Arial, sans-serif; font-size: 10pt; color: #333; padding: 15mm; width: 180mm; background-color: #fff;">`;
    html += `<h1 style="font-size: 16pt; color: #003366; margin-bottom: 10mm; border-bottom: 1px solid #ccc; padding-bottom: 3mm; text-align: center;">Распоряжение о постановке на учет кредитного договора</h1>`;

    const section = (title: string, contentHtml: string) => {
        return `<h2 style="font-size: 12pt; color: #004080; margin-top: 8mm; margin-bottom: 4mm; border-bottom: 1px solid #eee; padding-bottom: 2mm;">${title}</h2>${contentHtml}`;
    };

    const field = (label: string, value: any, type: 'date' | 'boolean' | 'currency' | 'percent' | 'string' | 'number' = 'string') => {
        return `<p style="margin-bottom: 2mm; display: flex;"><strong style="min-width: 180px; display: inline-block; color: #555;">${label}:</strong> <span style="flex-grow: 1; word-break: break-word;">${formatForDisplay(value, type)}</span></p>`;
    };
    
    const formatOptionalNumber = (val: number | null | undefined) => val === null || val === undefined ? undefined : val;


    // Общие элементы
    let generalHtml = field('Номер заявления', data.statementNumber) +
                      field('Дата заявления', data.statementDate, 'date') +
                      field('Наименование заемщика', data.borrowerName) +
                      field('ИНН заемщика', data.borrowerInn) +
                      field('Номер договора', data.contractNumber) +
                      field('Дата договора', data.contractDate, 'date') +
                      field('Вид кредитования', data.creditType) +
                      field('Валюта лимита/договора', data.limitCurrency) +
                      field('Сумма договора', data.contractAmount, 'number') + // Should be 'currency' if currency symbol is needed
                      field('Код подразделения банка', data.bankUnitCode) +
                      field('Срок действия договора', data.contractTerm) +
                      field('Расчётный счёт заемщика', data.borrowerAccountNumber) +
                      field('Категория предприятия', data.enterpriseCategory) +
                      field('Решение кредитного комитета (детали)', data.creditCommitteeDecisionDetails) +
                      field('Агент субсидии', data.subsidyAgent) +
                      field('Общие примечания и особые условия', data.generalNotesAndSpecialConditions);
    html += section('Общие элементы', generalHtml);

    // МСФО
    let msfoHtml = field('Результат SPPI-теста', data.sppiTestResult) +
                   field('Бизнес-модель владения активом', data.assetOwnershipBusinessModel) +
                   field('Оценка рыночности сделки', data.marketTransactionAssessment);
    html += section('Элементы для МСФО', msfoHtml);

    // Комиссионные сборы
    let commissionHtml = field('Вид комиссии', data.commissionType) +
                         field('Порядок расчета комиссий', data.commissionCalculationMethod);
    if (data.commissionPaymentSchedule && data.commissionPaymentSchedule.length > 0) {
        commissionHtml += `<p style="margin-bottom: 2mm;"><strong style="min-width: 180px; display: inline-block; color: #555;">График оплат комиссий:</strong></p><ul style="list-style-type: disc; margin-left: 20px; padding-left: 5px;">`;
        data.commissionPaymentSchedule.forEach(d => {
            commissionHtml += `<li style="margin-bottom: 1mm;">${formatForDisplay(d, 'date')}</li>`;
        });
        commissionHtml += `</ul>`;
    } else {
        commissionHtml += field('График оплат комиссий', 'Не указан');
    }
    html += section('Комиссионные сборы по договору', commissionHtml);

    // Условия досрочного погашения
    let earlyRepaymentHtml = '';
    if (data.earlyRepaymentConditions) {
        earlyRepaymentHtml += field('Обязательное досрочное погашение разрешено', data.earlyRepaymentConditions.mandatoryEarlyRepaymentAllowed, 'boolean') +
                             field('Добровольное досрочное погашение разрешено', data.earlyRepaymentConditions.voluntaryEarlyRepaymentAllowed, 'boolean') +
                             field('Источники финансирования досрочных выплат', data.earlyRepaymentConditions.earlyRepaymentFundingSources) +
                             field('Комиссия за досрочные выплаты (%)', formatOptionalNumber(data.earlyRepaymentConditions.earlyRepaymentCommissionRate), 'percent') +
                             field('Очередность погашения ОД и процентов', data.earlyRepaymentConditions.principalAndInterestRepaymentOrder) +
                             field('Мораторий на досрочное погашение (детали)', data.earlyRepaymentConditions.earlyRepaymentMoratoriumDetails);
    }
    html += section('Условия досрочного погашения', earlyRepaymentHtml || field('Условия', 'Не указаны'));

    // Штрафные санкции
    let penaltyHtml = '';
    if (data.penaltySanctions) {
        penaltyHtml += field('Штраф за просрочку ОД', data.penaltySanctions.latePrincipalPaymentPenalty) +
                      field('Штраф за просрочку процентов', data.penaltySanctions.lateInterestPaymentPenalty) +
                      field('Штраф за неоплату комиссий', data.penaltySanctions.lateCommissionPaymentPenalty) +
                      field('Индексация неустойки', data.penaltySanctions.penaltyIndexation, 'boolean');
    }
    html += section('Штрафные санкции за просрочку платежа', penaltyHtml || field('Санкции', 'Не указаны'));
    
    // Информация по сублимитам
    if (data.sublimitDetails && data.sublimitDetails.length > 0) {
        let sublimitsSectionHtml = '';
        data.sublimitDetails.forEach((sl, index) => {
            sublimitsSectionHtml += `<div style="border: 1px solid #eee; padding: 3mm; margin-bottom: 3mm; border-radius: 3px;">`;
            sublimitsSectionHtml += `<h3 style="font-size: 11pt; color: #0055A4; margin-top: 0; margin-bottom: 2mm;">Сублимит ${index + 1}</h3>`;
            sublimitsSectionHtml += field('Сумма', sl.sublimitAmount, 'number') + // Should be 'currency' if currency symbol is needed
                                   field('Валюта', sl.sublimitCurrency) +
                                   field('Период доступности', sl.sublimitAvailabilityPeriod) +
                                   field('Дата завершения', sl.sublimitExpiryDate, 'date') +
                                   field('Цель', sl.sublimitPurpose) +
                                   field('Инвестиционная фаза', sl.sublimitInvestmentPhase) +
                                   field('Порядок погашения', sl.sublimitRepaymentOrder);
            sublimitsSectionHtml += `</div>`;
        });
        html += section('Информация по сублимитам', sublimitsSectionHtml);
    } else {
        html += section('Информация по сублимитам', field('Сублимиты', 'Отсутствуют'));
    }

    // Дополнительные финансовые показатели
    let financialIndicatorsHtml = '';
    if (data.financialIndicatorsAndCalculations) {
        financialIndicatorsHtml += field('Ставка начисленных процентов (%)', formatOptionalNumber(data.financialIndicatorsAndCalculations.accruedInterestRate), 'percent') +
                                  field('Ставка капитализированных процентов (%)', formatOptionalNumber(data.financialIndicatorsAndCalculations.capitalizedInterestRate), 'percent') +
                                  field('Правила расчета начисленных процентов', data.financialIndicatorsAndCalculations.accruedInterestCalculationRules) +
                                  field('Регламент уплаты процентов', data.financialIndicatorsAndCalculations.interestPaymentRegulations) +
                                  field('Параметры резервирования', data.financialIndicatorsAndCalculations.debtAndCommissionReservingParams) +
                                  field('Коды страховых продуктов', data.financialIndicatorsAndCalculations.insuranceProductCodes) +
                                  field('Особые фин. условия договора', data.financialIndicatorsAndCalculations.specialContractConditions);
    }
    html += section('Дополнительные финансовые показатели и регламенты расчетов', financialIndicatorsHtml || field('Показатели', 'Не указаны'));

    // Административные блоки
    let adminHtml = field('Итоговая категория качества кредита', data.finalCreditQualityCategory) +
                    field('Исполнитель распоряжения (ФИО)', data.dispositionExecutorName) +
                    field('Авторизованное лицо (ФИО)', data.authorizedSignatory);
    html += section('Административные блоки', adminHtml);
    
    html += `<p style="margin-top: 10mm; font-size: 8pt; text-align: center; color: #777;">Документ сформирован автоматически системой "AI Мастерская" ${format(new Date(), "dd.MM.yyyy HH:mm")}</p>`;
    html += `</div>`;
    return html;
};


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
        earlyRepaymentConditions: { mandatoryEarlyRepaymentAllowed: false, voluntaryEarlyRepaymentAllowed: false },
        penaltySanctions: { penaltyIndexation: false },
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
      const processedFormData: Partial<FormValues> = {
          earlyRepaymentConditions: {}, // Ensure nested objects are initialized
          penaltySanctions: {},
          financialIndicatorsAndCalculations: {},
          sublimitDetails: [],
          sublimitDetailsJson: "[]",
      };

      (Object.keys(rawDataFromAI) as Array<keyof CreditDispositionCardData>).forEach(key => {
        const value = rawDataFromAI[key];
        if (key === 'statementDate' || key === 'contractDate') {
          (processedFormData as any)[key] = parseDateSafe(value);
        } else if (key === 'commissionPaymentSchedule' && Array.isArray(value)) {
          (processedFormData as any)[key] = value.map(d => parseDateSafe(d)).filter(d => d instanceof Date && isValid(d)); 
        } else if (key === 'sublimitDetails' && Array.isArray(value)) {
            const parsedSublimits = value.map(sl => ({
                ...sl,
                sublimitAmount: sl.sublimitAmount === null || sl.sublimitAmount === undefined || String(sl.sublimitAmount).trim() === "" ? null : (isNaN(parseFloat(String(sl.sublimitAmount))) ? null : parseFloat(String(sl.sublimitAmount))),
                sublimitExpiryDate: parseDateSafe(sl.sublimitExpiryDate)
            }));
            (processedFormData as any)[key] = parsedSublimits;
            try {
              (processedFormData as any).sublimitDetailsJson = JSON.stringify(parsedSublimits, null, 2);
            } catch (e) {
              console.error("Error stringifying sublimits for JSON field:", e);
              (processedFormData as any).sublimitDetailsJson = "[]";
               toast({ title: 'Ошибка', description: 'Не удалось сериализовать сублимиты для редактирования.', variant: 'destructive' });
            }
        } else if (key === 'contractAmount') {
             processedFormData.contractAmount = value === null || value === undefined || String(value).trim() === "" ? null : (isNaN(parseFloat(String(value))) ? null : parseFloat(String(value)));
        } else if (key === 'earlyRepaymentConditions' && value && typeof value === 'object') {
            processedFormData.earlyRepaymentConditions = { ...value,
                earlyRepaymentCommissionRate: (value as any).earlyRepaymentCommissionRate === null || (value as any).earlyRepaymentCommissionRate === undefined || String((value as any).earlyRepaymentCommissionRate).trim() === ""
                ? null
                : (isNaN(parseFloat(String((value as any).earlyRepaymentCommissionRate))) ? null : parseFloat(String((value as any).earlyRepaymentCommissionRate)))
            };
        } else if (key === 'financialIndicatorsAndCalculations' && value && typeof value === 'object') {
            const finCalculations = value as any;
            processedFormData.financialIndicatorsAndCalculations = { ...value,
                accruedInterestRate: finCalculations.accruedInterestRate === null || finCalculations.accruedInterestRate === undefined || String(finCalculations.accruedInterestRate).trim() === ""
                ? null
                : (isNaN(parseFloat(String(finCalculations.accruedInterestRate))) ? null : parseFloat(String(finCalculations.accruedInterestRate))),
                capitalizedInterestRate: finCalculations.capitalizedInterestRate === null || finCalculations.capitalizedInterestRate === undefined || String(finCalculations.capitalizedInterestRate).trim() === ""
                ? null
                : (isNaN(parseFloat(String(finCalculations.capitalizedInterestRate))) ? null : parseFloat(String(finCalculations.capitalizedInterestRate)))
            };
        } else if (key === 'penaltySanctions' && value && typeof value === 'object') {
             processedFormData.penaltySanctions = value;
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
      form.reset({
        commissionPaymentSchedule: [], 
        sublimitDetails: [], 
        sublimitDetailsJson: "[]",
        earlyRepaymentConditions: { mandatoryEarlyRepaymentAllowed: false, voluntaryEarlyRepaymentAllowed: false },
        penaltySanctions: { penaltyIndexation: false },
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
        earlyRepaymentConditions: { mandatoryEarlyRepaymentAllowed: false, voluntaryEarlyRepaymentAllowed: false },
        penaltySanctions: { penaltyIndexation: false },
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
    let parsedSublimitDetails: SublimitDetail[] = values.sublimitDetails || []; // Start with existing if any
    if (values.sublimitDetailsJson && values.sublimitDetailsJson.trim() !== "") {
      try {
        const parsedFromJson = JSON.parse(values.sublimitDetailsJson);
        if (!Array.isArray(parsedFromJson)) throw new Error("JSON не является массивом");
        
        parsedSublimitDetails = parsedFromJson.map(sl => ({
            ...sl,
            sublimitAmount: sl.sublimitAmount === null || sl.sublimitAmount === undefined || String(sl.sublimitAmount).trim() === "" ? null : (isNaN(parseFloat(String(sl.sublimitAmount))) ? null : parseFloat(String(sl.sublimitAmount))),
            sublimitExpiryDate: parseDateSafe(sl.sublimitExpiryDate) // Will be Date or undefined
        }));

      } catch (e) {
        form.setError("sublimitDetailsJson", { type: "manual", message: `Некорректный формат JSON: ${(e as Error).message}` });
        toast({ title: 'Ошибка JSON в сублимитах', description: `Некорректный формат JSON: ${(e as Error).message}. Изменения для сублимитов не сохранены.`, variant: 'destructive' });
        return; // Prevent saving if JSON is invalid
      }
    }


    setExtractedData(prev => {
        if (!prev) return null;
        // Create a deep copy of values to avoid direct state mutation issues with react-hook-form's internal state
        const updatedValues = JSON.parse(JSON.stringify(values));
        
        const updatedCardData = {
            ...updatedValues,
            sublimitDetails: parsedSublimitDetails, 
        } as CreditDispositionCardData;
        delete (updatedCardData as any).sublimitDetailsJson;

        return { ...prev, dispositionCard: updatedCardData };
    });

    setIsEditing(false);
    toast({ title: 'Изменения сохранены (локально)', description: 'Теперь вы можете экспортировать данные.' });
  };


  const handleExportPdf = async () => {
    if (!extractedData?.dispositionCard) {
        toast({ title: 'Нет данных для экспорта', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    
    const currentFormData = form.getValues(); // Get latest form values
    let finalSublimitDetails = currentFormData.sublimitDetails || [];

    // If in editing mode and sublimitDetailsJson has content, prioritize it after parsing
    if (isEditing && currentFormData.sublimitDetailsJson && currentFormData.sublimitDetailsJson.trim() !== "" && currentFormData.sublimitDetailsJson.trim() !== "[]") {
        try {
            const parsedJsonSublimits = JSON.parse(currentFormData.sublimitDetailsJson);
            if (Array.isArray(parsedJsonSublimits)) {
                 finalSublimitDetails = parsedJsonSublimits.map((sl: any) => ({
                    ...sl,
                    sublimitAmount: sl.sublimitAmount === null || sl.sublimitAmount === undefined || String(sl.sublimitAmount).trim() === "" ? null : (isNaN(parseFloat(String(sl.sublimitAmount))) ? null : parseFloat(String(sl.sublimitAmount))),
                    sublimitExpiryDate: parseDateSafe(sl.sublimitExpiryDate)
                }));
            }
        } catch (e) {
            console.warn("JSON для сублимитов невалиден при экспорте, используются данные из sublimitDetails.");
             // Fallback to sublimitDetails from form state if JSON is bad
        }
    }
    
    const dataForPdf = {
        ...currentFormData,
        sublimitDetails: finalSublimitDetails,
    };


    const htmlString = renderPdfHtml(dataForPdf);
    const pdfRenderAreaId = 'pdf-hidden-render-area';
    let pdfRenderArea = document.getElementById(pdfRenderAreaId);
    if (!pdfRenderArea) {
        pdfRenderArea = document.createElement('div');
        pdfRenderArea.id = pdfRenderAreaId;
        pdfRenderArea.style.position = 'absolute';
        pdfRenderArea.style.left = '-9999px'; // Position off-screen
        pdfRenderArea.style.top = '0';
        pdfRenderArea.style.width = '210mm'; // A4 width approx
        document.body.appendChild(pdfRenderArea);
    }
    pdfRenderArea.innerHTML = htmlString;

    try {
      await exportHtmlElementToPdf(pdfRenderAreaId, `Распоряжение_${extractedData.dispositionCard.contractNumber || 'бн'}`);
      toast({ title: 'Экспорт в PDF успешен' });
    } catch (e) {
      toast({ title: 'Ошибка экспорта PDF', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      if (pdfRenderArea) { // Clean up
          pdfRenderArea.innerHTML = '';
          // Optionally remove if it was dynamically added for just this export:
          // if (document.body.contains(pdfRenderArea)) document.body.removeChild(pdfRenderArea);
      }
    }
  };

  const handleExportJson = () => {
    if (!extractedData?.dispositionCard) return;
    
    let dataToExport = { ...form.getValues() } as Partial<FormValues>;

    if (dataToExport.sublimitDetailsJson && dataToExport.sublimitDetailsJson.trim() !== "") {
        try {
            const parsedSublimits = JSON.parse(dataToExport.sublimitDetailsJson);
            if (Array.isArray(parsedSublimits)) {
                dataToExport.sublimitDetails = parsedSublimits.map((sl: any) => ({
                    ...sl,
                    sublimitAmount: sl.sublimitAmount === null || sl.sublimitAmount === undefined || String(sl.sublimitAmount).trim() === "" ? null : (isNaN(parseFloat(String(sl.sublimitAmount))) ? null : parseFloat(String(sl.sublimitAmount))),
                    sublimitExpiryDate: sl.sublimitExpiryDate instanceof Date && isValid(sl.sublimitExpiryDate)
                        ? format(sl.sublimitExpiryDate, "yyyy-MM-dd")
                        : (typeof sl.sublimitExpiryDate === 'string' ? sl.sublimitExpiryDate : undefined) // keep string if already string
                }));
            }
        } catch (e) {
            console.warn("Invalid JSON in sublimitDetailsJson during JSON export, exporting current form value for sublimitDetails if available.");
            dataToExport.sublimitDetails = (form.getValues('sublimitDetails') || []).map(sl => ({
                 ...sl,
                 sublimitExpiryDate: sl.sublimitExpiryDate instanceof Date && isValid(sl.sublimitExpiryDate)
                        ? format(sl.sublimitExpiryDate, "yyyy-MM-dd")
                        : (typeof sl.sublimitExpiryDate === 'string' ? sl.sublimitExpiryDate : undefined)
            }));
        }
    }
    delete dataToExport.sublimitDetailsJson;


    const jsonString = JSON.stringify(dataToExport, (key, value) => {
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
  
  const renderFormField = (
    fieldName: keyof FormValues | `earlyRepaymentConditions.${string}` | `penaltySanctions.${string}` | `financialIndicatorsAndCalculations.${string}`, 
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
        name={fieldName as keyof FormValues} // Cast needed due to nested paths
        render={({ field }) => {
            let fieldValue = field.value;
             if (type === "text" || type === "textarea") {
                fieldValue = field.value === undefined || field.value === null ? "" : field.value;
            } else if (type === "number") {
                // For number inputs, an empty string is often preferred over 0 for display
                 fieldValue = field.value === undefined || field.value === null || field.value === "" ? "" : String(field.value);
            } else if (type === 'checkbox') {
                fieldValue = field.value === undefined || field.value === null ? false : field.value;
            } else if (type === 'objectArrayAsJsonString' && fieldName === 'sublimitDetailsJson') {
                if (readOnly) {
                    const actualArray = form.getValues('sublimitDetails');
                    try {
                        fieldValue = Array.isArray(actualArray) ? JSON.stringify(actualArray.map(s => ({...s, sublimitExpiryDate: s.sublimitExpiryDate instanceof Date && isValid(s.sublimitExpiryDate) ? format(s.sublimitExpiryDate, 'yyyy-MM-dd') : s.sublimitExpiryDate })), null, 2) : "[]";
                    } catch (e) { fieldValue = "[]"; }
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
                    {...form.register(fieldName as keyof FormValues)} 
                    defaultValue={fieldValue as string} 
                    readOnly={readOnly} 
                    rows={type === 'objectArrayAsJsonString' ? 8 : 3} 
                    className={cn("mt-0.5", commonInputClass, type === 'objectArrayAsJsonString' && 'font-mono text-xs')} 
                    placeholder={type === 'objectArrayAsJsonString' && !readOnly ? 'Введите массив объектов в формате JSON...' : (readOnly && !fieldValue ? 'Нет данных' : undefined)}
                />
                ) : type === 'select' && options ? (
                <Controller
                    control={form.control}
                    name={fieldName as keyof FormValues}
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
                        <SelectItem value="">Не выбрано</SelectItem>
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
                                    value={dateItem instanceof Date && isValid(dateItem) ? format(dateItem, "dd.MM.yyyy") : (typeof dateItem === 'string' ? dateItem : '')} 
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
                    {...form.register(fieldName as keyof FormValues, { 
                        valueAsNumber: type === 'number',
                        setValueAs: type === 'number' ? (v: any) => (v === "" || v === null || v === undefined ? null : parseFloat(v)) : undefined 
                    })} 
                    defaultValue={fieldValue as any} 
                    readOnly={readOnly} 
                    className={cn("mt-0.5", commonInputClass)} 
                    placeholder={readOnly && !fieldValue ? 'Нет данных' : undefined}
                />
                )}
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                <p className="text-xs text-destructive h-3">{(form.formState.errors as any)[fieldName]?.message || (form.formState.errors as any)[fieldName.split('.')[0]]?.[fieldName.split('.')[1]]?.message || ''}</p>
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
      
      {/* Hidden div for PDF rendering */}
      <div id="pdf-hidden-render-area" style={{ display: 'none' }}></div>

      {extractedData && (
        <Form {...form}> 
          <form onSubmit={form.handleSubmit(handleSaveEdits)}>
            <Card id="disposition-card-view" className="mt-4 shadow-xl rounded-xl"> {/* This ID is NOT for PDF export, but can be kept for other uses if any */}
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
                      {renderFormField('sublimitDetailsJson', 'Сублимиты (массив объектов JSON)', 'objectArrayAsJsonString', [], "Отредактируйте как массив JSON. Поля: sublimitAmount(number), sublimitCurrency(string), sublimitAvailabilityPeriod(string), sublimitExpiryDate(string 'yyyy-MM-dd'), sublimitPurpose(string), sublimitInvestmentPhase(string), sublimitRepaymentOrder(string).")}
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
                  <Button type="button" variant="outline" onClick={handleExportJson} disabled={isLoading}>
                      <Download className="mr-2 h-4 w-4" /> Экспорт в JSON
                  </Button>
                  <Button type="button" variant="outline" onClick={handleExportPdf} disabled={isLoading}>
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

