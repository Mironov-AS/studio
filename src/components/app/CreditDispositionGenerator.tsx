
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
import { Loader2, FileUp, Sparkles, Download, FileArchive, Edit3, Save, Trash2, CalendarIcon as LucideCalendarIcon, PackageOpen, CircleDollarSign, TrendingDown, ShieldAlert, Info, BookOpen, Users2, PlusCircle } from 'lucide-react';
import { exportHtmlElementToPdf } from '@/lib/pdfUtils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as ShadCalendar } from "@/components/ui/calendar"; 
import { format, parseISO, isValid, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Form, 
  FormControl,
  FormField, 
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


const ACCEPTABLE_FILE_EXTENSIONS = ".pdf";

// Zod schema for form validation - This must match the schema in generate-credit-disposition-flow.ts
// (excluding .describe() calls which are for AI guidance only)
const SublimitDetailSchemaClient = z.object({
  sublimitAmount: z.coerce.number().optional().nullable(),
  sublimitCurrency: z.string().optional(),
  sublimitAvailabilityPeriod: z.string().optional(),
  sublimitExpiryDate: z.union([z.date().nullable(), z.string().optional()]).optional(),
  sublimitPurpose: z.string().optional(),
  sublimitInvestmentPhase: z.string().optional(),
  sublimitRepaymentOrder: z.string().optional(),
});

const CreditDispositionCardZodSchemaClient = z.object({
  statementNumber: z.string().optional(),
  statementDate: z.union([z.date().nullable(), z.string().optional()]).optional(),
  borrowerName: z.string().optional(),
  borrowerInn: z.string().optional(),
  contractNumber: z.string().optional(),
  contractDate: z.union([z.date().nullable(), z.string().optional()]).optional(),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия', '']).optional(),
  limitCurrency: z.string().optional(),
  contractAmount: z.coerce.number().optional().nullable(),
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
    earlyRepaymentCommissionRate: z.coerce.number().optional().nullable(),
    principalAndInterestRepaymentOrder: z.string().optional(),
    earlyRepaymentMoratoriumDetails: z.string().optional(),
  }).optional().default({}),
  penaltySanctions: z.object({
    latePrincipalPaymentPenalty: z.string().optional(),
    lateInterestPaymentPenalty: z.string().optional(),
    lateCommissionPaymentPenalty: z.string().optional(),
    penaltyIndexation: z.boolean().optional(),
  }).optional().default({}),
  sublimitDetails: z.array(SublimitDetailSchemaClient).optional().default([]),
  financialIndicatorsAndCalculations: z.object({
    accruedInterestRate: z.coerce.number().optional().nullable(),
    capitalizedInterestRate: z.coerce.number().optional().nullable(),
    accruedInterestCalculationRules: z.string().optional(),
    interestPaymentRegulations: z.string().optional(),
    debtAndCommissionReservingParams: z.string().optional(),
    insuranceProductCodes: z.string().optional(),
    specialContractConditions: z.string().optional(),
  }).optional().default({}),
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное', 'Не определена', '']).optional(),
  dispositionExecutorName: z.string().optional(),
  authorizedSignatory: z.string().optional(),
});

type FormValues = z.infer<typeof CreditDispositionCardZodSchemaClient>; 

// Helper function to format values for PDF display
const formatForDisplay = (value: any, type: 'date' | 'boolean' | 'currency' | 'percent' | 'string' | 'number' = 'string'): string => {
    if (value === undefined || value === null || String(value).trim() === '') {
        return 'Не указано';
    }
    if (type === 'date') {
        if (value instanceof Date && isValid(value)) {
            return format(value, "dd.MM.yyyy", { locale: ru });
        }
        // Attempt to parse if it's a string that might be a date
        if (typeof value === 'string') {
            const parsed = parseDateSafe(value); // Try ISO first
            if (parsed && isValid(parsed)) return format(parsed, "dd.MM.yyyy", { locale: ru });
        }
        return String(value); // Fallback
    }
    if (type === 'boolean') {
        return value ? 'Да' : 'Нет';
    }
    if (type === 'currency' && typeof value === 'number') { 
        return `${value.toLocaleString('ru-RU')} ${ (form.getValues('limitCurrency') || 'RUB')}`; 
    }
    if (type === 'percent' && typeof value === 'number') {
        return `${value.toLocaleString('ru-RU')}%`;
    }
    if (type === 'number' && typeof value === 'number') { 
        return value.toLocaleString('ru-RU');
    }
    return String(value);
};

const parseDateSafe = (dateInput: any): Date | undefined => {
    if (!dateInput) return undefined;
    if (dateInput instanceof Date && isValid(dateInput)) return dateInput;
    
    if (typeof dateInput === 'string') {
      let dateAttempt: Date | undefined;
      // Try ISO format first (more common from AI)
      dateAttempt = parseISO(dateInput);
      if (isValid(dateAttempt)) return dateAttempt;

      // Try dd.MM.yyyy
      dateAttempt = parse(dateInput, 'dd.MM.yyyy', new Date());
      if (isValid(dateAttempt)) return dateAttempt;
      
      // Try yyyy-MM-dd (often used in DBs or other systems)
      dateAttempt = parse(dateInput, 'yyyy-MM-dd', new Date());
      if (isValid(dateAttempt)) return dateAttempt;
      
      return undefined; // Could not parse
    }
    return undefined; 
  };
  
const parseNumberSafe = (value: any): number | null => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const num = parseFloat(String(value).replace(/,/g, '.').replace(/\s/g, '')); // Handle comma as decimal and remove spaces
    return isNaN(num) ? null : num;
};

const renderPdfHtml = (data: FormValues): string => {
    let html = `<div id="pdf-render-content-inner" style="font-family: Arial, sans-serif; font-size: 10pt; color: #333; padding: 15mm; width: 180mm; background-color: #fff;">`;
    html += `<h1 style="font-size: 16pt; color: #003366; margin-bottom: 10mm; border-bottom: 1px solid #ccc; padding-bottom: 3mm; text-align: center;">Распоряжение о постановке на учет кредитного договора</h1>`;

    const section = (title: string, contentHtml: string) => {
        return `<h2 style="font-size: 12pt; color: #004080; margin-top: 8mm; margin-bottom: 4mm; border-bottom: 1px solid #eee; padding-bottom: 2mm;">${title}</h2>${contentHtml}`;
    };

    const field = (label: string, value: any, type: 'date' | 'boolean' | 'currency' | 'percent' | 'string' | 'number' = 'string') => {
        const formattedValue = formatForDisplay(value, type);
        // Avoid printing "Не указано: Не указано" by checking formattedValue directly
        const displayValue = (formattedValue === 'Не указано' && (value === undefined || value === null || String(value).trim() === '')) ? 'Не указано' : formattedValue;

        return `<p style="margin-bottom: 2mm; display: flex;"><strong style="min-width: 180px; display: inline-block; color: #555;">${label}:</strong> <span style="flex-grow: 1; word-break: break-word;">${displayValue}</span></p>`;
    };
    
    const formatOptionalNumber = (val: number | null | undefined) => val === null || val === undefined ? undefined : val;


    let generalHtml = field('Номер заявления', data.statementNumber) +
                      field('Дата заявления', data.statementDate, 'date') +
                      field('Наименование заемщика', data.borrowerName) +
                      field('ИНН заемщика', data.borrowerInn) +
                      field('Номер договора', data.contractNumber) +
                      field('Дата договора', data.contractDate, 'date') +
                      field('Вид кредитования', data.creditType) +
                      field('Валюта лимита/договора', data.limitCurrency) +
                      field('Сумма договора/лимита', formatOptionalNumber(data.contractAmount), data.limitCurrency ? 'currency' : 'number') + 
                      field('Код подразделения банка', data.bankUnitCode) +
                      field('Срок действия договора', data.contractTerm) +
                      field('Расчётный счёт заемщика', data.borrowerAccountNumber) +
                      field('Категория предприятия', data.enterpriseCategory) +
                      field('Решение кредитного комитета (детали)', data.creditCommitteeDecisionDetails) +
                      field('Агент субсидии', data.subsidyAgent) +
                      field('Общие примечания и особые условия', data.generalNotesAndSpecialConditions);
    html += section('Общие элементы', generalHtml);

    let msfoHtml = field('Результат SPPI-теста', data.sppiTestResult) +
                   field('Бизнес-модель владения активом', data.assetOwnershipBusinessModel) +
                   field('Оценка рыночности сделки', data.marketTransactionAssessment);
    html += section('Элементы для МСФО', msfoHtml);

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

    let penaltyHtml = '';
    if (data.penaltySanctions) {
        penaltyHtml += field('Штраф за просрочку ОД', data.penaltySanctions.latePrincipalPaymentPenalty) +
                      field('Штраф за просрочку процентов', data.penaltySanctions.lateInterestPaymentPenalty) +
                      field('Штраф за неоплату комиссий', data.penaltySanctions.lateCommissionPaymentPenalty) +
                      field('Индексация неустойки', data.penaltySanctions.penaltyIndexation, 'boolean');
    }
    html += section('Штрафные санкции за просрочку платежа', penaltyHtml || field('Санкции', 'Не указаны'));
    
    if (data.sublimitDetails && data.sublimitDetails.length > 0) {
        let sublimitsSectionHtml = '';
        data.sublimitDetails.forEach((sl, index) => {
            sublimitsSectionHtml += `<div style="border: 1px solid #eee; padding: 3mm; margin-bottom: 3mm; border-radius: 3px;">`;
            sublimitsSectionHtml += `<h3 style="font-size: 11pt; color: #0055A4; margin-top: 0; margin-bottom: 2mm;">Сублимит ${index + 1}</h3>`;
            sublimitsSectionHtml += field('Сумма', formatOptionalNumber(sl.sublimitAmount), sl.sublimitCurrency ? 'currency' : 'number') + 
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

    let adminHtml = field('Итоговая категория качества кредита', data.finalCreditQualityCategory) +
                    field('Исполнитель распоряжения (ФИО)', data.dispositionExecutorName) +
                    field('Авторизованное лицо (ФИО)', data.authorizedSignatory);
    html += section('Административные блоки', adminHtml);
    
    html += `<p style="margin-top: 10mm; font-size: 8pt; text-align: center; color: #777;">Документ сформирован автоматически системой "AI Мастерская" ${format(new Date(), "dd.MM.yyyy HH:mm", {locale: ru})}</p>`;
    html += `</div>`;
    return html;
};

// Make form global for PDF currency rendering
let form: ReturnType<typeof useForm<FormValues>>;

export default function CreditDispositionGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<GenerateCreditDispositionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  form = useForm<FormValues>({
    resolver: zodResolver(CreditDispositionCardZodSchemaClient), 
    defaultValues: {
        statementNumber: '',
        statementDate: undefined,
        borrowerName: '',
        borrowerInn: '',
        contractNumber: '',
        contractDate: undefined,
        creditType: '',
        limitCurrency: 'RUB', 
        contractAmount: null,
        bankUnitCode: '',
        contractTerm: '',
        borrowerAccountNumber: '',
        enterpriseCategory: '',
        creditCommitteeDecisionDetails: '',
        subsidyAgent: '',
        generalNotesAndSpecialConditions: '',
        sppiTestResult: '',
        assetOwnershipBusinessModel: '',
        marketTransactionAssessment: '',
        commissionType: '',
        commissionCalculationMethod: '',
        commissionPaymentSchedule: [],
        earlyRepaymentConditions: { 
            mandatoryEarlyRepaymentAllowed: false, 
            voluntaryEarlyRepaymentAllowed: false,
            earlyRepaymentFundingSources: '',
            earlyRepaymentCommissionRate: null,
            principalAndInterestRepaymentOrder: '',
            earlyRepaymentMoratoriumDetails: '',
        },
        penaltySanctions: { 
            latePrincipalPaymentPenalty: '',
            lateInterestPaymentPenalty: '',
            lateCommissionPaymentPenalty: '',
            penaltyIndexation: false,
         },
        sublimitDetails: [],
        financialIndicatorsAndCalculations: {
            accruedInterestRate: null,
            capitalizedInterestRate: null,
            accruedInterestCalculationRules: '',
            interestPaymentRegulations: '',
            debtAndCommissionReservingParams: '',
            insuranceProductCodes: '',
            specialContractConditions: '',
        },
        finalCreditQualityCategory: '',
        dispositionExecutorName: '',
        authorizedSignatory: '',
    },
  });

  const { fields: sublimitFields, append: appendSublimit, remove: removeSublimit } = useFieldArray({
    control: form.control,
    name: "sublimitDetails"
  });


  useEffect(() => {
    if (extractedData?.dispositionCard) {
      const rawDataFromAI = extractedData.dispositionCard;
      const defaultValuesFromForm = form.formState.defaultValues || {};
      
      const processedFormData: Partial<FormValues> = {
        ...defaultValuesFromForm, 
        earlyRepaymentConditions: { ...(defaultValuesFromForm.earlyRepaymentConditions || {}), ...rawDataFromAI.earlyRepaymentConditions },
        penaltySanctions: { ...(defaultValuesFromForm.penaltySanctions || {}), ...rawDataFromAI.penaltySanctions },
        financialIndicatorsAndCalculations: { ...(defaultValuesFromForm.financialIndicatorsAndCalculations || {}), ...rawDataFromAI.financialIndicatorsAndCalculations },
        sublimitDetails: [], 
      };

      (Object.keys(rawDataFromAI) as Array<keyof CreditDispositionCardData>).forEach(key => {
        const value = rawDataFromAI[key];
        if (key === 'statementDate' || key === 'contractDate') {
          const parsedDate = parseDateSafe(value);
          (processedFormData as any)[key] = parsedDate;
          if (value && !parsedDate) {
            toast({
              title: "Предупреждение о формате даты",
              description: `Не удалось автоматически распознать дату для поля '${key}'. Пожалуйста, проверьте и установите ее вручную. (Получено: "${value}")`,
              variant: "default",
              duration: 7000,
            });
          }
        } else if (key === 'commissionPaymentSchedule' && Array.isArray(value)) {
          (processedFormData as any)[key] = value.map(d => parseDateSafe(d)).filter(d => d instanceof Date && isValid(d)); 
        } else if (key === 'sublimitDetails' && Array.isArray(value)) {
            const parsedSublimits = value.map(sl => {
                const parsedSublimitDate = parseDateSafe(sl.sublimitExpiryDate);
                if (sl.sublimitExpiryDate && !parsedSublimitDate) {
                   toast({
                     title: "Предупреждение о формате даты сублимита",
                     description: `Не удалось автоматически распознать дату завершения для одного из сублимитов. Пожалуйста, проверьте и установите ее вручную. (Получено: "${sl.sublimitExpiryDate}")`,
                     variant: "default",
                     duration: 7000,
                   });
                }
                return {
                    ...sl,
                    sublimitAmount: parseNumberSafe(sl.sublimitAmount),
                    sublimitExpiryDate: parsedSublimitDate
                };
            });
            (processedFormData as any)[key] = parsedSublimits;
        } else if (key === 'contractAmount' || key === 'earlyRepaymentConditions.earlyRepaymentCommissionRate' || key === 'financialIndicatorsAndCalculations.accruedInterestRate' || key === 'financialIndicatorsAndCalculations.capitalizedInterestRate' ) {
             // Handle nested number fields correctly by parsing them
             if (key === 'contractAmount') {
                 processedFormData.contractAmount = parseNumberSafe(value);
             } else if (key === 'earlyRepaymentConditions.earlyRepaymentCommissionRate' && processedFormData.earlyRepaymentConditions) {
                 processedFormData.earlyRepaymentConditions.earlyRepaymentCommissionRate = parseNumberSafe(value);
             } else if (key === 'financialIndicatorsAndCalculations.accruedInterestRate' && processedFormData.financialIndicatorsAndCalculations) {
                processedFormData.financialIndicatorsAndCalculations.accruedInterestRate = parseNumberSafe(value);
             } else if (key === 'financialIndicatorsAndCalculations.capitalizedInterestRate' && processedFormData.financialIndicatorsAndCalculations) {
                processedFormData.financialIndicatorsAndCalculations.capitalizedInterestRate = parseNumberSafe(value);
             }
        } else if (key === 'earlyRepaymentConditions' && typeof value === 'object' && value !== null) {
             processedFormData.earlyRepaymentConditions = {
                ...(defaultValuesFromForm.earlyRepaymentConditions || {}),
                ...value,
                earlyRepaymentCommissionRate: parseNumberSafe((value as any).earlyRepaymentCommissionRate)
             };
        } else if (key === 'financialIndicatorsAndCalculations' && typeof value === 'object' && value !== null) {
             processedFormData.financialIndicatorsAndCalculations = {
                ...(defaultValuesFromForm.financialIndicatorsAndCalculations || {}),
                ...value,
                accruedInterestRate: parseNumberSafe((value as any).accruedInterestRate),
                capitalizedInterestRate: parseNumberSafe((value as any).capitalizedInterestRate),
             };
        } else if (key === 'penaltySanctions' && typeof value === 'object' && value !== null) {
             processedFormData.penaltySanctions = {
                ...(defaultValuesFromForm.penaltySanctions || {}),
                ...value,
             };
        } else {
          const fieldDefinition = CreditDispositionCardZodSchemaClient.shape[key as keyof typeof CreditDispositionCardZodSchemaClient.shape];
          if (fieldDefinition instanceof z.ZodOptional && fieldDefinition._def.innerType instanceof z.ZodEnum) {
            (processedFormData as any)[key] = value ?? '';
          } else {
            (processedFormData as any)[key] = value;
          }
        }
      });
      
      form.reset(processedFormData as FormValues);
      setIsEditing(false); 
      if (!rawDataFromAI.borrowerName && !rawDataFromAI.contractNumber && (rawDataFromAI.contractAmount === null || rawDataFromAI.contractAmount === undefined)) {
         toast({
            title: "Внимание: Низкая точность извлечения",
            description: "Не удалось извлечь ключевые данные (Имя заемщика, Номер или Сумма договора). Возможно, документ сложный для анализа или имеет нестандартный формат. Пожалуйста, проверьте все поля вручную.",
            variant: "destructive",
            duration: 10000, 
          });
      }

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
      form.reset(form.formState.defaultValues); 
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
    form.reset(form.formState.defaultValues);
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
    const sublimitDetailsWithNumbers = (values.sublimitDetails || []).map(sl => ({
        ...sl,
        sublimitAmount: parseNumberSafe(sl.sublimitAmount)
    }));

    setExtractedData(prev => {
        if (!prev) return null;
        const updatedCardData = { 
            ...values, 
            sublimitDetails: sublimitDetailsWithNumbers 
        } as CreditDispositionCardData; 
        return { ...prev, dispositionCard: updatedCardData };
    });

    setIsEditing(false);
    toast({ title: 'Изменения сохранены (локально)', description: 'Теперь вы можете экспортировать данные.' });
  };


  const handleExportPdf = async () => {
    if (!extractedData?.dispositionCard && Object.keys(form.getValues()).length === 0) { 
        toast({ title: 'Нет данных для экспорта', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    
    const currentFormData = form.getValues(); 
    const dataForPdf = { ...currentFormData };

    const htmlString = renderPdfHtml(dataForPdf);
    const pdfRenderAreaId = 'pdf-hidden-render-area';
    let pdfRenderArea = document.getElementById(pdfRenderAreaId);
    if (!pdfRenderArea) {
        pdfRenderArea = document.createElement('div');
        pdfRenderArea.id = pdfRenderAreaId;
        pdfRenderArea.style.position = 'absolute';
        pdfRenderArea.style.left = '-9999px'; 
        pdfRenderArea.style.top = '0';
        pdfRenderArea.style.width = '210mm'; 
        document.body.appendChild(pdfRenderArea);
    }
    pdfRenderArea.innerHTML = htmlString;

    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      await exportHtmlElementToPdf(pdfRenderAreaId, `Распоряжение_${dataForPdf.contractNumber || 'бн'}`);
      toast({ title: 'Экспорт в PDF успешен' });
    } catch (e) {
      console.error("PDF Export error:", e);
      toast({ title: 'Ошибка экспорта PDF', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      if (pdfRenderArea) { 
          pdfRenderArea.innerHTML = ''; 
      }
    }
  };

  const handleExportJson = () => {
     const currentFormData = { ...form.getValues() };
    if (!currentFormData && !extractedData?.dispositionCard) {
        toast({ title: 'Нет данных для экспорта', variant: 'destructive' });
        return;
    }

    let dataToExport: any = { ...currentFormData };

    const formatDateForJson = (dateInput: any) => {
        if (dateInput instanceof Date && isValid(dateInput)) {
            return format(dateInput, "yyyy-MM-dd");
        }
        if (typeof dateInput === 'string') { 
            const parsed = parseDateSafe(dateInput);
            if (parsed) return format(parsed, "yyyy-MM-dd");
        }
        return dateInput; 
    };

    dataToExport.statementDate = formatDateForJson(dataToExport.statementDate);
    dataToExport.contractDate = formatDateForJson(dataToExport.contractDate);
    
    if (dataToExport.commissionPaymentSchedule && Array.isArray(dataToExport.commissionPaymentSchedule)) {
        dataToExport.commissionPaymentSchedule = dataToExport.commissionPaymentSchedule.map(formatDateForJson);
    }

    if (dataToExport.sublimitDetails && Array.isArray(dataToExport.sublimitDetails)) {
        dataToExport.sublimitDetails = dataToExport.sublimitDetails.map((sl: any) => ({
            ...sl,
            sublimitExpiryDate: formatDateForJson(sl.sublimitExpiryDate),
            sublimitAmount: parseNumberSafe(sl.sublimitAmount) 
        }));
    }
    
    dataToExport.contractAmount = parseNumberSafe(dataToExport.contractAmount);
    if (dataToExport.earlyRepaymentConditions) {
        dataToExport.earlyRepaymentConditions.earlyRepaymentCommissionRate = parseNumberSafe(dataToExport.earlyRepaymentConditions.earlyRepaymentCommissionRate);
    }
    if (dataToExport.financialIndicatorsAndCalculations) {
        dataToExport.financialIndicatorsAndCalculations.accruedInterestRate = parseNumberSafe(dataToExport.financialIndicatorsAndCalculations.accruedInterestRate);
        dataToExport.financialIndicatorsAndCalculations.capitalizedInterestRate = parseNumberSafe(dataToExport.financialIndicatorsAndCalculations.capitalizedInterestRate);
    }


    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Распоряжение_${currentFormData.contractNumber || 'бн'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Экспорт в JSON успешен' });
  };
  
  const renderFormField = (
    control: any, 
    fieldName: string, 
    label: string, 
    type: "text" | "number" | "textarea" | "select" | "checkbox" | "date" | "dateArray", 
    options?: string[],
    description?: string,
    isReadOnlyOverride?: boolean 
  ) => {
    const readOnly = isReadOnlyOverride !== undefined ? isReadOnlyOverride : !isEditing;
    const commonInputClass = "bg-card read-only:bg-muted/30 read-only:border-transparent read-only:focus-visible:ring-0 read-only:cursor-default";

    return (
      <FormField
        control={control} 
        name={fieldName as keyof FormValues} 
        render={({ field }) => {
            let fieldValue = field.value;
             if (type === "text" || type === "textarea") {
                fieldValue = field.value === undefined || field.value === null ? "" : field.value;
            } else if (type === "number") {
                 fieldValue = field.value === undefined || field.value === null || String(field.value).trim() === "" ? "" : String(field.value);
            } else if (type === 'checkbox') {
                fieldValue = field.value === undefined || field.value === null ? false : field.value;
            }

            return (
            <FormItem className="mb-3 flex flex-col">
                <FormLabel htmlFor={fieldName} className="text-sm font-medium mb-1">{label}</FormLabel>
                {type === 'textarea' ? (
                <Textarea 
                    id={fieldName} 
                    {...form.register(fieldName as keyof FormValues)} 
                    defaultValue={fieldValue as string} 
                    readOnly={readOnly} 
                    rows={3} 
                    className={cn("mt-0.5", commonInputClass)} 
                    placeholder={(readOnly && (fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '') ? 'Нет данных' : undefined)}
                />
                ) : type === 'select' && options ? (
                <Controller
                    control={control}
                    name={fieldName as keyof FormValues}
                    render={({ field: controllerField }) => (
                    <Select 
                        onValueChange={controllerField.onChange} 
                        value={String(controllerField.value ?? '')} 
                        disabled={readOnly}
                    >
                        <SelectTrigger className={cn("mt-0.5 w-full", commonInputClass)}>
                           <SelectValue placeholder={`Выберите ${label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                           {options.filter(opt => opt !== "").map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    )}
                />
                ) : type === 'checkbox' ? (
                 <div className="mt-0.5 flex items-center h-10">
                    <Checkbox 
                        id={fieldName} 
                        checked={fieldValue as boolean} 
                        onCheckedChange={(checkedState) => field.onChange(checkedState)}
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
                        <LucideCalendarIcon className="mr-2 h-4 w-4" /> 
                        {field.value instanceof Date && isValid(field.value)
                            ? format(field.value, "dd.MM.yyyy", { locale: ru })
                            : ((typeof field.value === 'string' && parseDateSafe(field.value)) 
                               ? format(parseDateSafe(field.value)!, "dd.MM.yyyy", { locale: ru })
                               : <span>Выберите дату</span>)
                        }
                    </Button>
                    </PopoverTrigger>
                    {!readOnly && (
                        <PopoverContent className="w-auto p-0">
                        <ShadCalendar 
                            mode="single"
                            selected={field.value instanceof Date && isValid(field.value) ? field.value : (typeof field.value === 'string' ? parseDateSafe(field.value) : undefined)}
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
                                    <ShadCalendar 
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
                <Input 
                    id={fieldName} 
                    type={type === 'number' ? 'number' : 'text'} 
                    step={type === 'number' ? 'any' : undefined}
                    {...form.register(fieldName as keyof FormValues, { 
                        valueAsNumber: type === 'number',
                        setValueAs: type === 'number' ? (v: any) => (v === "" || v === null || v === undefined ? null : parseFloat(String(v).replace(/,/g, '.'))) : undefined 
                    })} 
                    defaultValue={fieldValue as any} 
                    readOnly={readOnly} 
                    className={cn("mt-0.5", commonInputClass)} 
                    placeholder={readOnly && (fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '') ? 'Нет данных' : undefined}
                />
                )}
                {description && <FormDescription className="text-xs mt-1">{description}</FormDescription>}
                <FormMessage className="text-xs h-3"/>
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
            {isLoading && !extractedData ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
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
      
      <div id="pdf-hidden-render-area" style={{ position: 'absolute', left: '-9999px', top: '0', width: '210mm' }}></div>


      {(extractedData || isEditing) && ( 
        <Form {...form}> 
          <form onSubmit={form.handleSubmit(handleSaveEdits)}>
            <Card id="disposition-card-view" className="mt-4 shadow-xl rounded-xl"> 
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                      <CardTitle className="text-xl">Проект распоряжения</CardTitle>
                      <CardDescription>{isEditing ? "Редактируйте извлеченные данные." : "Проверьте извлеченные данные. Нажмите 'Редактировать' для внесения изменений."}</CardDescription>
                  </div>
                  {!isEditing ? (
                      <Button type="button" variant="outline" onClick={() => setIsEditing(true)} disabled={isLoading || (!extractedData && !Object.values(form.getValues()).some(v => v !== null && v !== undefined && v !== ''))}>
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
                      {renderFormField(form.control, 'statementNumber', 'Номер заявления', 'text')}
                      {renderFormField(form.control, 'statementDate', 'Дата заявления', 'date')}
                      {renderFormField(form.control, 'borrowerName', 'Название заемщика', 'text')}
                      {renderFormField(form.control, 'borrowerInn', 'ИНН заемщика', 'text')}
                      {renderFormField(form.control, 'contractNumber', 'Номер договора', 'text')}
                      {renderFormField(form.control, 'contractDate', 'Дата договора', 'date')}
                      {renderFormField(form.control, 'creditType', 'Вид кредитования', 'select', ['Кредитная линия', 'Возобновляемая кредитная линия', ''])}
                      {renderFormField(form.control, 'limitCurrency', 'Валюта лимита/договора', 'text')}
                      {renderFormField(form.control, 'contractAmount', 'Сумма договора/лимита', 'number')}
                      {renderFormField(form.control, 'bankUnitCode', 'Код подразделения банка', 'text')}
                      {renderFormField(form.control, 'contractTerm', 'Срок действия договора', 'text')}
                      {renderFormField(form.control, 'borrowerAccountNumber', 'Расчётный счёт заемщика', 'text')}
                      {renderFormField(form.control, 'enterpriseCategory', 'Категория предприятия', 'select', ['Среднее', 'Малое', 'Микро', 'Не применимо', ''])}
                      {renderFormField(form.control, 'creditCommitteeDecisionDetails', 'Решение кредитного комитета (детали)', 'text')}
                      {renderFormField(form.control, 'subsidyAgent', 'Агент субсидии', 'text')}
                      {renderFormField(form.control, 'generalNotesAndSpecialConditions', 'Общие примечания и особые условия', 'textarea')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="msfo">
                    <AccordionTrigger className="text-lg hover:no-underline"><BookOpen className="mr-2 h-5 w-5 text-primary" />МСФО</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField(form.control, 'sppiTestResult', 'Результат SPPI-теста', 'text')}
                      {renderFormField(form.control, 'assetOwnershipBusinessModel', 'Бизнес-модель владения активом', 'select', ['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное', ''])}
                      {renderFormField(form.control, 'marketTransactionAssessment', 'Оценка рыночности сделки', 'select', ['Рыночная', 'Нерыночная', 'Не удалось определить', ''])}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="commission">
                    <AccordionTrigger className="text-lg hover:no-underline"><CircleDollarSign className="mr-2 h-5 w-5 text-primary" />Комиссионные сборы</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField(form.control, 'commissionType', 'Вид комиссии', 'select', ["Фиксированная", "Переменная", "Отсутствует", "Комбинированная", ""])}
                      {renderFormField(form.control, 'commissionCalculationMethod', 'Порядок расчета комиссий', 'textarea')}
                      {renderFormField(form.control, 'commissionPaymentSchedule', 'График оплат комиссий', 'dateArray')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="repayment">
                    <AccordionTrigger className="text-lg hover:no-underline"><TrendingDown className="mr-2 h-5 w-5 text-primary" />Условия досрочного погашения</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                        {renderFormField(form.control, 'earlyRepaymentConditions.mandatoryEarlyRepaymentAllowed', 'Обязательное досрочное погашение разрешено', 'checkbox')}
                        {renderFormField(form.control, 'earlyRepaymentConditions.voluntaryEarlyRepaymentAllowed', 'Добровольное досрочное погашение разрешено', 'checkbox')}
                        {renderFormField(form.control, 'earlyRepaymentConditions.earlyRepaymentFundingSources', 'Источники финансирования досрочных выплат', 'textarea')}
                        {renderFormField(form.control, 'earlyRepaymentConditions.earlyRepaymentCommissionRate', 'Комиссия за досрочные выплаты (%)', 'number')}
                        {renderFormField(form.control, 'earlyRepaymentConditions.principalAndInterestRepaymentOrder', 'Очередность погашения ОД и процентов', 'textarea')}
                        {renderFormField(form.control, 'earlyRepaymentConditions.earlyRepaymentMoratoriumDetails', 'Мораторий на досрочное погашение (детали)', 'textarea')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="penalties">
                    <AccordionTrigger className="text-lg hover:no-underline"><ShieldAlert className="mr-2 h-5 w-5 text-primary" />Штрафные санкции</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                        {renderFormField(form.control, 'penaltySanctions.latePrincipalPaymentPenalty', 'Штраф за просрочку ОД', 'text')}
                        {renderFormField(form.control, 'penaltySanctions.lateInterestPaymentPenalty', 'Штраф за просрочку процентов', 'text')}
                        {renderFormField(form.control, 'penaltySanctions.lateCommissionPaymentPenalty', 'Штраф за неоплату комиссий', 'text')}
                        {renderFormField(form.control, 'penaltySanctions.penaltyIndexation', 'Индексация неустойки', 'checkbox')}
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="sublimits">
                    <AccordionTrigger className="text-lg hover:no-underline"><PackageOpen className="mr-2 h-5 w-5 text-primary" />Информация по сублимитам</AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-4">
                      {sublimitFields.map((item, index) => (
                        <Card key={item.id} className="p-4 bg-secondary/30 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-md">Сублимит {index + 1}</h4>
                            {isEditing && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeSublimit(index)} title="Удалить сублимит">
                                  <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0">
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitAmount`, 'Сумма сублимита', 'number')}
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitCurrency`, 'Валюта', 'text')}
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitAvailabilityPeriod`, 'Период доступности', 'text')}
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitExpiryDate`, 'Дата завершения', 'date')}
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitPurpose`, 'Цель', 'textarea')}
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitInvestmentPhase`, 'Инвестиционная фаза', 'text')}
                            {renderFormField(form.control, `sublimitDetails.${index}.sublimitRepaymentOrder`, 'Порядок погашения', 'textarea')}
                          </div>
                        </Card>
                      ))}
                      {isEditing && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => appendSublimit({ 
                                sublimitAmount: null, 
                                sublimitCurrency: 'RUB', 
                                sublimitAvailabilityPeriod: '', 
                                sublimitExpiryDate: undefined, 
                                sublimitPurpose: '', 
                                sublimitInvestmentPhase: '', 
                                sublimitRepaymentOrder: '' 
                            })}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> Добавить сублимит
                        </Button>
                      )}
                       {(!sublimitFields || sublimitFields.length === 0) && !isEditing && (
                            <p className="text-sm text-muted-foreground py-2">Сублимиты не указаны.</p>
                        )}
                    </AccordionContent>
                  </AccordionItem>

                   <AccordionItem value="financial">
                    <AccordionTrigger className="text-lg hover:no-underline"><CircleDollarSign className="mr-2 h-5 w-5 text-primary" />Финансовые показатели и расчеты</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.accruedInterestRate', 'Ставка начисленных процентов (%)', 'number')}
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.capitalizedInterestRate', 'Ставка капитализированных процентов (%)', 'number')}
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.accruedInterestCalculationRules', 'Правила расчета начисленных процентов', 'textarea')}
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.interestPaymentRegulations', 'Регламент уплаты процентов', 'textarea')}
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.debtAndCommissionReservingParams', 'Параметры резервирования', 'textarea')}
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.insuranceProductCodes', 'Коды страховых продуктов', 'text')}
                        {renderFormField(form.control, 'financialIndicatorsAndCalculations.specialContractConditions', 'Особые фин. условия договора', 'textarea')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="admin">
                    <AccordionTrigger className="text-lg hover:no-underline"><Users2 className="mr-2 h-5 w-5 text-primary" />Административные блоки</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
                      {renderFormField(form.control, 'finalCreditQualityCategory', 'Итоговая категория качества кредита', 'select', ['Хорошее', 'Проблемное', 'Просроченное', 'Не определена', ''])}
                      {renderFormField(form.control, 'dispositionExecutorName', 'Исполнитель распоряжения (ФИО)', 'text')}
                      {renderFormField(form.control, 'authorizedSignatory', 'Авторизованное лицо (ФИО)', 'text')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
              <CardFooter className="mt-4 pt-4 border-t flex flex-col sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleExportJson} disabled={isLoading || isEditing}>
                      <Download className="mr-2 h-4 w-4" /> Экспорт в JSON
                  </Button>
                  <Button type="button" variant="outline" onClick={handleExportPdf} disabled={isLoading || isEditing}>
                      {isLoading && !fileDataUri && extractedData && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
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
