
'use server';
/**
 * @fileOverview Generates a credit agreement disposition card with detailed financial and legal attributes.
 *
 * - generateCreditDisposition - Function to handle credit disposition generation.
 * - GenerateCreditDispositionInput - Input type for the function.
 * - GenerateCreditDispositionOutput - Output type for the function.
 * - CreditDispositionCardData - The type for the disposition card data.
 * - SublimitDetail - Type for individual sublimit details.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const GenerateCreditDispositionInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The credit agreement PDF document as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  fileName: z.string().optional().describe('The original name of the PDF file.'),
});
export type GenerateCreditDispositionInput = z.infer<typeof GenerateCreditDispositionInputSchema>;

// Schema for individual sublimit details
const SublimitDetailSchema = z.object({
  sublimitAmount: z.coerce.number().optional().nullable().describe("Сумма сублимита (только числовое значение, например 500000)."),
  sublimitCurrency: z.string().optional().describe("Валюта сублимита (например, RUB, USD)."),
  sublimitAvailabilityPeriod: z.string().optional().describe("Период доступности сублимита (например, 'до 31.12.2025', 'В течение 6 месяцев с даты выдачи')."),
  sublimitExpiryDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe("Дата завершения действия сублимита (ГГГГ-ММ-ДД)."),
  sublimitPurpose: z.string().optional().describe("Цели, на которые выделялся сублимит (например, 'Пополнение оборотных средств', 'Приобретение оборудования')."),
  sublimitInvestmentPhase: z.string().optional().describe("Инвестиционная фаза сублимита (например, 'Инвестиционная', 'Операционная')."),
  sublimitRepaymentOrder: z.string().optional().describe("Особенности порядка погашения задолженности по сублимиту (например, 'Погашение после основного долга', 'Аннуитетные платежи')."),
});
export type SublimitDetail = z.infer<typeof SublimitDetailSchema>;

// Local schema for the disposition card. Not exported as an object.
const CreditDispositionCardZodSchema = z.object({
  // Общие элементы
  statementNumber: z.string().optional().describe('Уникальный идентификатор заявки (Номер заявления в кредитной дороге).'),
  statementDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe('Дата заявления (ГГГГ-ММ-ДД).'),
  borrowerName: z.string().optional().describe('Полное юридическое название заемщика.'),
  borrowerInn: z.string().optional().describe('ИНН заемщика.'),
  contractNumber: z.string().optional().describe('Номер подписанного кредитного договора.'),
  contractDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe('Дата подписания договора (ГГГГ-ММ-ДД).'),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия']).optional().describe('Тип кредита (например, "Кредитная линия", "Возобновляемая кредитная линия").'),
  limitCurrency: z.string().optional().describe('Валюта кредитного лимита/общей суммы договора (например, RUB, USD).'),
  contractAmount: z.coerce.number().optional().nullable().describe('Общая сумма кредита/договора или лимит кредитования (только числовое значение, например, 1500000.75).'),
  bankUnitCode: z.string().optional().describe('Код подразделения банка, в котором обслуживается заемщик.'),
  contractTerm: z.string().optional().describe('Срок действия договора (например, "36 месяцев", "до ДД.ММ.ГГГГ").'),
  borrowerAccountNumber: z.string().optional().describe('Банковский расчётный счёт заемщика.'),
  enterpriseCategory: z.enum(['Среднее', 'Малое', 'Микро', 'Не применимо']).optional().describe('Признак субъекта МСП или "Не применимо".'),
  creditCommitteeDecisionDetails: z.string().optional().describe('Детали решения кредитного комитета (например, номер протокола, дата). Если просто "да/нет", указать "Решение принято" или "Решение отсутствует".'),
  subsidyAgent: z.string().optional().describe('Организация, предоставляющая субсидии.'),
  generalNotesAndSpecialConditions: z.string().optional().describe('Общие дополнительные примечания и особые условия (например, наличие субсидий, льготных ставок).'),

  // Элементы, специфичные для бухгалтерского учета по стандартам МСФО
  sppiTestResult: z.string().optional().describe('Результат SPPI-теста (например, "Пройден успешно", "Не пройден", "Соответствует критериям SPPI").'),
  assetOwnershipBusinessModel: z.enum(['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное']).optional().describe('Бизнес-модель владения активом (например, "Удерживать для продажи", "Удерживать для получения денежных потоков", "Иное").'),
  marketTransactionAssessment: z.enum(['Рыночная', 'Нерыночная', 'Не удалось определить']).optional().describe('Оценка рыночности сделки (рыночной стоимости договора) (например, "Рыночная", "Нерыночная", "Не удалось определить").'),

  // Комиссионные сборы по договору
  commissionType: z.enum(["Фиксированная", "Переменная", "Отсутствует", "Комбинированная"]).optional().describe("Вид комиссии (например, \"Фиксированная\", \"Переменная\", \"Отсутствует\", \"Комбинированная\")."),
  commissionCalculationMethod: z.string().optional().describe("Порядок расчета сумм комиссий (алгоритм вычисления или конкретные цифры, например '0.5% от суммы выдачи', '10000 RUB единовременно')."),
  commissionPaymentSchedule: z.array(z.union([z.date(), z.string()])).optional().describe("Графики платежей комиссий (массив дат в формате ГГГГ-ММ-ДД)."),
  
  // Условия досрочного погашения
  earlyRepaymentConditions: z.object({
    mandatoryEarlyRepaymentAllowed: z.boolean().optional().describe("Возможность обязательного досрочного погашения (true/false)."),
    voluntaryEarlyRepaymentAllowed: z.boolean().optional().describe("Возможность добровольного досрочного погашения (true/false)."),
    earlyRepaymentFundingSources: z.string().optional().describe("Источники финансирования досрочных выплат (например, 'Собственные средства Заемщика', 'Рефинансирование')."),
    earlyRepaymentCommissionRate: z.coerce.number().optional().nullable().describe("Размер комиссий за досрочные выплаты (в процентах, только числовое значение, например 1.5)."),
    principalAndInterestRepaymentOrder: z.string().optional().describe("Очередность погашения основного долга и процентов при досрочном погашении (например, 'Сначала проценты, затем основной долг')."),
    earlyRepaymentMoratoriumDetails: z.string().optional().describe("Ограничительные моратории на возможность досрочно погасить долг (описание условий или \"Отсутствует\")."),
  }).optional().describe("Детали условий досрочного погашения."),

  // Штрафные санкции за просрочку платежа
  penaltySanctions: z.object({
    latePrincipalPaymentPenalty: z.string().optional().describe("Размеры штрафов за несвоевременную оплату основной части займа (например, \"0.1% в день от суммы просрочки\", \"Фиксированная сумма 5000 RUB\")."),
    lateInterestPaymentPenalty: z.string().optional().describe("Размеры санкций за задержку оплаты начисленных процентов (например, \"Аналогично штрафу за просрочку ОД\")."),
    lateCommissionPaymentPenalty: z.string().optional().describe("Штрафы за неоплату комиссий (например, \"0.05% в день от суммы неоплаченной комиссии\")."),
    penaltyIndexation: z.boolean().optional().describe('Применяется ли увеличение размера неустойки (true/false).'),
  }).optional().describe("Детали штрафных санкций."),

  // Информация по сублимитам
  sublimitDetails: z.array(SublimitDetailSchema).optional().describe("Массив объектов с детальной информацией по каждому сублимиту."),

  // Дополнительные финансовые показатели и регламенты расчетов
  financialIndicatorsAndCalculations: z.object({
    accruedInterestRate: z.coerce.number().optional().nullable().describe("Процентные ставки для начисленных процентов (число, например, 12.5 для 12.5%)."),
    capitalizedInterestRate: z.coerce.number().optional().nullable().describe("Процентные ставки для капитализированных процентов (число, например 0.5)."),
    accruedInterestCalculationRules: z.string().optional().describe("Правила и алгоритмы расчета начисленных процентов (например, 'На остаток основного долга', 'Формула X')."),
    interestPaymentRegulations: z.string().optional().describe("Регламент уплат процентов (например, 'Ежемесячно, не позднее 5-го числа', 'В конце срока')."),
    debtAndCommissionReservingParams: z.string().optional().describe("Параметры резервирования по долгу и комиссиям (например, 'Согласно Положению ЦБ РФ № XXX')."),
    insuranceProductCodes: z.string().optional().describe("Специфические коды страховых продуктов, если применимо."),
    specialContractConditions: z.string().optional().describe("Особые условия договора, относящиеся к финансовым расчетам, не вошедшие в другие поля."),
  }).optional().describe("Финансовые показатели и регламенты."),

  // Административные блоки
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное', 'Не определена']).optional().describe('Итоговая категория качества кредита (соответствие нормам ЦБ) или "Не определена".'),
  dispositionExecutorName: z.string().optional().describe('ФИО сотрудника, подготовившего распоряжение.'),
  authorizedSignatory: z.string().optional().describe('Лицо, имеющее полномочия подписи от банка (ФИО).'),
});
export type CreditDispositionCardData = z.infer<typeof CreditDispositionCardZodSchema>;


const GenerateCreditDispositionOutputSchema = z.object({
  dispositionCard: CreditDispositionCardZodSchema,
});
export type GenerateCreditDispositionOutput = z.infer<typeof GenerateCreditDispositionOutputSchema>;


export async function generateCreditDisposition(input: GenerateCreditDispositionInput): Promise<GenerateCreditDispositionOutput> {
  return generateCreditDispositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCreditDispositionPrompt',
  input: { schema: GenerateCreditDispositionInputSchema },
  output: { schema: GenerateCreditDispositionOutputSchema },
  prompt: `Вы — AI-ассистент, специализирующийся на анализе кредитных договоров на русском языке.
Ваша задача — тщательно проанализировать предоставленный PDF-документ кредитного договора и извлечь информацию для формирования "Распоряжения о постановке на учет".

Внимательно проанализируйте весь документ. Если какой-либо атрибут из перечисленных ниже отсутствует в договоре или не может быть однозначно определен, оставьте соответствующее поле в JSON-выводе пустым или со значением по умолчанию, как это предусмотрено схемой (например, false для boolean, пустой массив для массивов дат/объектов, undefined или null для опциональных полей). Не придумывайте информацию, если ее нет в документе.
Для числовых полей возвращайте только числовое значение (например, 1500000.75), без текста, символов валют или разделителей тысяч.
Для дат используйте формат ГГГГ-ММ-ДД.

Документ для анализа (кредитный договор в формате PDF):
{{media url=documentDataUri}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Извлеките следующие данные для dispositionCard:

**Общие элементы:**
- statementNumber: Уникальный идентификатор заявки (Номер заявления в кредитной дороге).
- statementDate: Дата заявления (ГГГГ-ММ-ДД).
- borrowerName: Полное юридическое название заемщика.
- borrowerInn: ИНН заемщика.
- contractNumber: Номер подписанного кредитного договора.
- contractDate: Дата подписания договора (ГГГГ-ММ-ДД).
- creditType: Тип кредита (одно из: "Кредитная линия", "Возобновляемая кредитная линия").
- limitCurrency: Валюта кредитного лимита/общей суммы договора (например, RUB, USD).
- contractAmount: Общая сумма кредита/договора или установленный лимит кредитования (только числовое значение, например, 1500000.75).
- bankUnitCode: Код подразделения банка, в котором обслуживается заемщик.
- contractTerm: Срок действия договора (например, "36 месяцев", "до ДД.ММ.ГГГГ").
- borrowerAccountNumber: Банковский расчётный счёт заемщика.
- enterpriseCategory: Признак субъекта МСП (одно из: "Среднее", "Малое", "Микро", "Не применимо").
- creditCommitteeDecisionDetails: Детали решения кредитного комитета (например, номер протокола, дата). Если просто "да/нет", указать "Решение принято" или "Решение отсутствует".
- subsidyAgent: Организация, предоставляющая субсидии.
- generalNotesAndSpecialConditions: Общие дополнительные примечания и особые условия (например, наличие субсидий, льготных ставок).

**Элементы для МСФО:**
- sppiTestResult: Результат SPPI-теста (например, "Пройден успешно", "Не пройден", "Соответствует критериям SPPI").
- assetOwnershipBusinessModel: Бизнес-модель владения активом (одно из: "Удерживать для продажи", "Удерживать для получения денежных потоков", "Иное").
- marketTransactionAssessment: Оценка рыночности сделки (рыночной стоимости договора) (одно из: "Рыночная", "Нерыночная", "Не удалось определить").

**Комиссионные сборы:**
- commissionType: Вид комиссии (одно из: "Фиксированная", "Переменная", "Отсутствует", "Комбинированная").
- commissionCalculationMethod: Порядок расчета сумм комиссий (алгоритм вычисления или конкретные цифры, например '0.5% от суммы выдачи', '10000 RUB единовременно').
- commissionPaymentSchedule: Графики платежей комиссий (массив строк в формате ГГГГ-ММ-ДД).

**Условия досрочного погашения (объект earlyRepaymentConditions):**
- mandatoryEarlyRepaymentAllowed: Возможность обязательного досрочного погашения (true/false).
- voluntaryEarlyRepaymentAllowed: Возможность добровольного досрочного погашения (true/false).
- earlyRepaymentFundingSources: Источники финансирования досрочных выплат (например, 'Собственные средства Заемщика', 'Рефинансирование').
- earlyRepaymentCommissionRate: Размер комиссий за досрочные выплаты (в процентах, только числовое значение, например 1.5).
- principalAndInterestRepaymentOrder: Очередность погашения основного долга и процентов при досрочном погашении (например, 'Сначала проценты, затем основной долг').
- earlyRepaymentMoratoriumDetails: Ограничительные моратории на возможность досрочно погасить долг (описание условий или "Отсутствует").

**Штрафные санкции (объект penaltySanctions):**
- latePrincipalPaymentPenalty: Размеры штрафов за несвоевременную оплату основной части займа (например, "0.1% в день от суммы просрочки", "Фиксированная сумма 5000 RUB").
- lateInterestPaymentPenalty: Размеры санкций за задержку оплаты начисленных процентов (например, "Аналогично штрафу за просрочку ОД").
- lateCommissionPaymentPenalty: Штрафы за неоплату комиссий (например, "0.05% в день от суммы неоплаченной комиссии").
- penaltyIndexation: Применяется ли увеличение размера неустойки (true/false).

**Информация по сублимитам (массив объектов sublimitDetails). Если сублимиты не найдены, оставьте sublimitDetails пустым массивом:**
Для каждого сублимита:
  - sublimitAmount: Сумма сублимита (только числовое значение, например 500000).
  - sublimitCurrency: Валюта сублимита (например, RUB, USD).
  - sublimitAvailabilityPeriod: Период доступности сублимита (например, 'до 31.12.2025', 'В течение 6 месяцев с даты выдачи').
  - sublimitExpiryDate: Дата завершения действия сублимита (ГГГГ-ММ-ДД).
  - sublimitPurpose: Цели, на которые выделялся сублимит (например, 'Пополнение оборотных средств', 'Приобретение оборудования').
  - sublimitInvestmentPhase: Инвестиционная фаза сублимита (например, 'Инвестиционная', 'Операционная').
  - sublimitRepaymentOrder: Особенности порядка погашения задолженности по сублимиту (например, 'Погашение после основного долга', 'Аннуитетные платежи').

**Дополнительные финансовые показатели (объект financialIndicatorsAndCalculations):**
- accruedInterestRate: Процентные ставки для начисленных процентов (число, например 12.5).
- capitalizedInterestRate: Процентные ставки для капитализированных процентов (число, например 0.5).
- accruedInterestCalculationRules: Правила и алгоритмы расчета начисленных процентов (например, 'На остаток основного долга', 'Формула X').
- interestPaymentRegulations: Регламент уплат процентов (например, 'Ежемесячно, не позднее 5-го числа', 'В конце срока').
- debtAndCommissionReservingParams: Параметры резервирования по долгу и комиссиям (например, 'Согласно Положению ЦБ РФ № XXX').
- insuranceProductCodes: Специфические коды страховых продуктов, если применимо.
- specialContractConditions: Особые условия договора, относящиеся к финансовым расчетам, не вошедшие в другие поля.

**Административные блоки:**
- finalCreditQualityCategory: Итоговая категория качества кредита (одно из: "Хорошее", "Проблемное", "Просроченное", "Не определена").
- dispositionExecutorName: ФИО сотрудника, подготовившего распоряжение.
- authorizedSignatory: Лицо, имеющее полномочия подписи от банка (ФИО).

Убедитесь, что все текстовые описания и извлеченная информация на русском языке.
Структурируйте ответ строго согласно указанным полям вывода в объекте 'dispositionCard'.
Если в документе нет информации для целого объекта (например, earlyRepaymentConditions), этот объект можно опустить (если он опционален по схеме) или вернуть с пустыми/null значениями для его полей.
`,
});

const generateCreditDispositionFlow = ai.defineFlow(
  {
    name: 'generateCreditDispositionFlow',
    inputSchema: GenerateCreditDispositionInputSchema,
    outputSchema: GenerateCreditDispositionOutputSchema,
  },
  async (input: GenerateCreditDispositionInput): Promise<GenerateCreditDispositionOutput> => {
    const dataUriParts = input.documentDataUri.match(/^data:(.+?);base64,(.*)$/);
    if (!dataUriParts || dataUriParts[1] !== 'application/pdf') {
      throw new Error('Неверный формат файла. Ожидается PDF файл в формате data URI.');
    }

    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 1500; 
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const result = await prompt(input, {
          config: {
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          }
        });
        const output = result.output;

        if (output && output.dispositionCard) {
          // Ensure arrays exist, even if empty, and nested objects are initialized if not present
          // This matches the .default({}) or .default([]) in the Zod schema for client-side form stability.
          output.dispositionCard.sublimitDetails = output.dispositionCard.sublimitDetails || [];
          output.dispositionCard.commissionPaymentSchedule = output.dispositionCard.commissionPaymentSchedule || [];
          
          // Ensure nested objects exist, even if empty, before accessing their properties or passing to form
          output.dispositionCard.earlyRepaymentConditions = output.dispositionCard.earlyRepaymentConditions || {
            mandatoryEarlyRepaymentAllowed: undefined,
            voluntaryEarlyRepaymentAllowed: undefined,
            earlyRepaymentFundingSources: undefined,
            earlyRepaymentCommissionRate: undefined,
            principalAndInterestRepaymentOrder: undefined,
            earlyRepaymentMoratoriumDetails: undefined,
          };
          output.dispositionCard.penaltySanctions = output.dispositionCard.penaltySanctions || {
            latePrincipalPaymentPenalty: undefined,
            lateInterestPaymentPenalty: undefined,
            lateCommissionPaymentPenalty: undefined,
            penaltyIndexation: undefined,
          };
          output.dispositionCard.financialIndicatorsAndCalculations = output.dispositionCard.financialIndicatorsAndCalculations || {
            accruedInterestRate: undefined,
            capitalizedInterestRate: undefined,
            accruedInterestCalculationRules: undefined,
            interestPaymentRegulations: undefined,
            debtAndCommissionReservingParams: undefined,
            insuranceProductCodes: undefined,
            specialContractConditions: undefined,
          };
          
          // Check for at least some critical fields, simple retry trigger
          if (!output.dispositionCard.borrowerName && !output.dispositionCard.contractNumber && attempt < MAX_RETRIES -1) {
            console.warn(`Attempt ${attempt + 1}: Critical fields missing (borrowerName or contractNumber). Retrying...`);
            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }
          return output;
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не вернул ожидаемый результат (dispositionCard) после нескольких попыток.');
        }

      } catch (e: any) {
        const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e);
        const isRetryableError = 
          errorMessage.includes('503') || 
          errorMessage.includes('overloaded') || 
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('rate limit') || 
          errorMessage.includes('resource has been exhausted') ||
          errorMessage.includes('deadline exceeded') ||
          errorMessage.includes('internal error') ||
          errorMessage.includes('try again later') ||
          errorMessage.includes('429');
        
        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            throw new Error('Сервис временно перегружен или достигнут лимит запросов. Пожалуйста, попробуйте позже.');
          }
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Attempt ${attempt + 1}: Retryable error encountered: ${errorMessage}. Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error("Non-retryable error in generateCreditDispositionFlow:", e);
          throw e; 
        }
      }
      attempt++;
    }
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);


      