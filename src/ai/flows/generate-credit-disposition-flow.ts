
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
  sublimitAmount: z.coerce.number().optional().describe("Сумма сублимита (только числовое значение)."),
  sublimitCurrency: z.string().optional().describe("Валюта сублимита."),
  sublimitAvailabilityPeriod: z.string().optional().describe("Период доступности сублимита."),
  sublimitExpiryDate: z.union([z.date(), z.string()]).optional().describe("Дата завершения действия сублимита (ГГГГ-ММ-ДД)."),
  sublimitPurpose: z.string().optional().describe("Цели, на которые выделялся сублимит."),
  sublimitInvestmentPhase: z.string().optional().describe("Инвестиционная фаза сублимита."),
  sublimitRepaymentOrder: z.string().optional().describe("Особенности порядка погашения задолженности по сублимиту."),
});
export type SublimitDetail = z.infer<typeof SublimitDetailSchema>;

// Local schema for the disposition card. Not exported as an object.
const CreditDispositionCardZodSchema = z.object({
  // Общие элементы
  statementNumber: z.string().optional().describe('Уникальный идентификатор заявки (Номер заявления в кредитной дороге).'),
  statementDate: z.union([z.date(), z.string()]).optional().describe('Дата заявления (ГГГГ-ММ-ДД).'),
  borrowerName: z.string().optional().describe('Полное юридическое название заемщика.'),
  borrowerInn: z.string().optional().describe('ИНН заемщика.'),
  contractNumber: z.string().optional().describe('Номер подписанного кредитного договора.'),
  contractDate: z.union([z.date(), z.string()]).optional().describe('Дата подписания договора (ГГГГ-ММ-ДД).'),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия']).optional().describe('Тип кредита.'),
  limitCurrency: z.string().optional().describe('Валюта кредитного лимита/общей суммы договора (например, RUB, USD).'),
  contractAmount: z.coerce.number().optional().describe('Общая сумма кредита/договора (только числовое значение).'),
  bankUnitCode: z.string().optional().describe('Код подразделения банка, в котором обслуживается заемщик.'),
  contractTerm: z.string().optional().describe('Срок действия договора (например, "36 месяцев", "до ДД.ММ.ГГГГ").'),
  borrowerAccountNumber: z.string().optional().describe('Банковский расчётный счёт заемщика.'),
  enterpriseCategory: z.enum(['Среднее', 'Малое', 'Микро', 'Не применимо']).optional().describe('Признак субъекта МСП или "Не применимо".'),
  creditCommitteeDecisionDetails: z.string().optional().describe('Детали решения кредитного комитета (например, номер протокола, дата). Если просто "да/нет", указать "Решение принято" или "Решение отсутствует".'),
  subsidyAgent: z.string().optional().describe('Организация, предоставляющая субсидии.'),
  generalNotesAndSpecialConditions: z.string().optional().describe('Общие дополнительные примечания и особые условия (например, наличие субсидий, льготных ставок).'),

  // Элементы, специфичные для бухгалтерского учета по стандартам МСФО
  sppiTestResult: z.string().optional().describe('Результат SPPI-теста (например, "Пройден успешно", "Не пройден", "Соответствует критериям SPPI").'),
  assetOwnershipBusinessModel: z.enum(['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное']).optional().describe('Бизнес-модель владения активом.'),
  marketTransactionAssessment: z.enum(['Рыночная', 'Нерыночная', 'Не удалось определить']).optional().describe('Оценка рыночности сделки (рыночной стоимости договора).'),

  // Комиссионные сборы по договору
  commissionType: z.enum(["Фиксированная", "Переменная", "Отсутствует", "Комбинированная"]).optional().describe("Вид комиссии."),
  commissionCalculationMethod: z.string().optional().describe("Порядок расчета сумм комиссий (алгоритм вычисления или конкретные цифры)."),
  commissionPaymentSchedule: z.array(z.union([z.date(), z.string()])).optional().describe("Графики платежей комиссий (массив дат в формате ГГГГ-ММ-ДД)."),
  
  // Условия досрочного погашения
  earlyRepaymentConditions: z.object({
    mandatoryEarlyRepaymentAllowed: z.boolean().optional().describe("Возможность обязательного досрочного погашения (true/false)."),
    voluntaryEarlyRepaymentAllowed: z.boolean().optional().describe("Возможность добровольного досрочного погашения (true/false)."),
    earlyRepaymentFundingSources: z.string().optional().describe("Источники финансирования досрочных выплат."),
    earlyRepaymentCommissionRate: z.coerce.number().optional().describe("Размер комиссий за досрочные выплаты (в процентах, только числовое значение)."),
    principalAndInterestRepaymentOrder: z.string().optional().describe("Очередность погашения основного долга и процентов при досрочном погашении."),
    earlyRepaymentMoratoriumDetails: z.string().optional().describe("Ограничительные моратории на возможность досрочно погасить долг (описание условий или \"Отсутствует\")."),
  }).optional().describe("Детали условий досрочного погашения."),

  // Штрафные санкции за просрочку платежа
  penaltySanctions: z.object({
    latePrincipalPaymentPenalty: z.string().optional().describe("Размеры штрафов за несвоевременную оплату основной части займа (например, \"0.1% в день от суммы просрочки\")."),
    lateInterestPaymentPenalty: z.string().optional().describe("Размеры санкций за задержку оплаты начисленных процентов."),
    lateCommissionPaymentPenalty: z.string().optional().describe("Штрафы за неоплату комиссий."),
    penaltyIndexation: z.boolean().optional().describe('Применяется ли увеличение размера неустойки (true/false).'),
  }).optional().describe("Детали штрафных санкций."),

  // Информация по сублимитам
  sublimitDetails: z.array(SublimitDetailSchema).optional().describe("Массив объектов с детальной информацией по каждому сублимиту."),

  // Дополнительные финансовые показатели и регламенты расчетов
  financialIndicatorsAndCalculations: z.object({
    accruedInterestRate: z.coerce.number().optional().describe("Процентные ставки для начисленных процентов (число, например, 12.5 для 12.5%)."),
    capitalizedInterestRate: z.coerce.number().optional().describe("Процентные ставки для капитализированных процентов (число)."),
    accruedInterestCalculationRules: z.string().optional().describe("Правила и алгоритмы расчета начисленных процентов."),
    interestPaymentRegulations: z.string().optional().describe("Регламент уплат процентов."),
    debtAndCommissionReservingParams: z.string().optional().describe("Параметры резервирования по долгу и комиссиям."),
    insuranceProductCodes: z.string().optional().describe("Специфические коды страховых продуктов."),
    specialContractConditions: z.string().optional().describe("Особые условия договора, относящиеся к финансовым расчетам."),
  }).optional().describe("Финансовые показатели и регламенты."),

  // Административные блоки
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное', 'Не определена']).optional().describe('Итоговая категория качества кредита (соответствие нормам ЦБ) или "Не определена".'),
  dispositionExecutorName: z.string().optional().describe('ФИО сотрудника, подготовившего распоряжение.'),
  authorizedSignatory: z.string().optional().describe('Лицо, имеющее полномочия подписи (ФИО).'),
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

Документ для анализа (кредитный договор в формате PDF):
{{media url=documentDataUri}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Проанализируйте документ и извлеките следующие атрибуты. Если какой-то атрибут отсутствует в договоре или не может быть однозначно определен, оставьте соответствующее поле пустым или со значением по умолчанию (например, false для boolean, пустой массив для dateArray/objectArray, undefined для optional полей). Даты должны быть в формате ГГГГ-ММ-ДД.

Извлеките следующие данные для dispositionCard:

**Общие элементы:**
- statementNumber: Номер заявления в кредитной дороге.
- statementDate: Дата заявления (ГГГГ-ММ-ДД).
- borrowerName: Полное юридическое название заемщика.
- borrowerInn: ИНН заемщика.
- contractNumber: Номер подписанного кредитного договора.
- contractDate: Дата подписания договора (ГГГГ-ММ-ДД).
- creditType: Тип кредита (одно из: "Кредитная линия", "Возобновляемая кредитная линия").
- limitCurrency: Валюта кредитного лимита/общей суммы договора.
- contractAmount: Общая сумма кредита/договора (только числовое значение, например, 1500000.75, без текста или символов валют).
- bankUnitCode: Код подразделения банка, в котором обслуживается заемщик.
- contractTerm: Срок действия договора (например, "36 месяцев", "до ДД.ММ.ГГГГ").
- borrowerAccountNumber: Банковский расчётный счёт заемщика.
- enterpriseCategory: Признак субъекта МСП (одно из: "Среднее", "Малое", "Микро", "Не применимо").
- creditCommitteeDecisionDetails: Детали решения кредитного комитета (например, номер протокола, дата). Если просто "да/нет", указать "Решение принято" или "Решение отсутствует".
- subsidyAgent: Организация, предоставляющая субсидии.
- generalNotesAndSpecialConditions: Общие дополнительные примечания и особые условия.

**Элементы для МСФО:**
- sppiTestResult: Результат SPPI-теста.
- assetOwnershipBusinessModel: Бизнес-модель владения активом (одно из: "Удерживать для продажи", "Удерживать для получения денежных потоков", "Иное").
- marketTransactionAssessment: Оценка рыночности сделки (одно из: "Рыночная", "Нерыночная", "Не удалось определить").

**Комиссионные сборы:**
- commissionType: Вид комиссии (одно из: "Фиксированная", "Переменная", "Отсутствует", "Комбинированная").
- commissionCalculationMethod: Порядок расчета сумм комиссий.
- commissionPaymentSchedule: Графики платежей комиссий (массив строк в формате ГГГГ-ММ-ДД).

**Условия досрочного погашения (объект earlyRepaymentConditions):**
- mandatoryEarlyRepaymentAllowed: Возможность обязательного досрочного погашения (true/false).
- voluntaryEarlyRepaymentAllowed: Возможность добровольного досрочного погашения (true/false).
- earlyRepaymentFundingSources: Источники финансирования досрочных выплат.
- earlyRepaymentCommissionRate: Размер комиссий за досрочные выплаты (в процентах, только числовое значение).
- principalAndInterestRepaymentOrder: Очередность погашения основного долга и процентов.
- earlyRepaymentMoratoriumDetails: Ограничительные моратории на досрочное погашение (описание или "Отсутствует").

**Штрафные санкции (объект penaltySanctions):**
- latePrincipalPaymentPenalty: Размеры штрафов за несвоевременную оплату основной части займа.
- lateInterestPaymentPenalty: Размеры санкций за задержку оплаты начисленных процентов.
- lateCommissionPaymentPenalty: Штрафы за неоплату комиссий.
- penaltyIndexation: Применяется ли увеличение размера неустойки (true/false).

**Информация по сублимитам (массив объектов sublimitDetails):**
Для каждого сублимита:
  - sublimitAmount: Сумма сублимита (только числовое значение, например 500000).
  - sublimitCurrency: Валюта сублимита.
  - sublimitAvailabilityPeriod: Период доступности сублимита.
  - sublimitExpiryDate: Дата завершения действия сублимита (ГГГГ-ММ-ДД).
  - sublimitPurpose: Цели, на которые выделялся сублимит.
  - sublimitInvestmentPhase: Инвестиционная фаза сублимита.
  - sublimitRepaymentOrder: Особенности порядка погашения задолженности по сублимиту.
Если сублимиты не найдены, оставьте sublimitDetails пустым массивом или не включайте его.

**Дополнительные финансовые показатели (объект financialIndicatorsAndCalculations):**
- accruedInterestRate: Процентные ставки для начисленных процентов (число, например 12.5).
- capitalizedInterestRate: Процентные ставки для капитализированных процентов (число).
- accruedInterestCalculationRules: Правила и алгоритмы расчета начисленных процентов.
- interestPaymentRegulations: Регламент уплат процентов.
- debtAndCommissionReservingParams: Параметры резервирования по долгу и комиссиям.
- insuranceProductCodes: Специфические коды страховых продуктов.
- specialContractConditions: Особые условия договора, относящиеся к финансовым расчетам.

**Административные блоки:**
- finalCreditQualityCategory: Итоговая категория качества кредита (одно из: "Хорошее", "Проблемное", "Просроченное", "Не определена").
- dispositionExecutorName: ФИО сотрудника, подготовившего распоряжение.
- authorizedSignatory: Лицо, имеющее полномочия подписи от банка.

Убедитесь, что все текстовые описания и извлеченная информация на русском языке.
Структурируйте ответ строго согласно указанным полям вывода в объекте 'dispositionCard'.
Для дат используйте формат ГГГГ-ММ-ДД. Числовые значения должны быть числами, а не строками.
Поля boolean должны быть true или false.
Если в документе нет информации для целого объекта (например, earlyRepaymentConditions), этот объект можно опустить.
Если в документе нет информации для массива объектов (например, sublimitDetails), этот массив должен быть пустым.
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
        // Устанавливаем более мягкие настройки безопасности, если это необходимо для анализа юридических документов
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
          // Убедимся, что массивы существуют, даже если они пустые
          if (!output.dispositionCard.sublimitDetails) {
            output.dispositionCard.sublimitDetails = [];
          }
          if (!output.dispositionCard.commissionPaymentSchedule) {
            output.dispositionCard.commissionPaymentSchedule = [];
          }
          // Убедимся, что вложенные объекты существуют, если они опциональны
          if (!output.dispositionCard.earlyRepaymentConditions) {
             output.dispositionCard.earlyRepaymentConditions = {};
          }
          if (!output.dispositionCard.penaltySanctions) {
             output.dispositionCard.penaltySanctions = {};
          }
          if (!output.dispositionCard.financialIndicatorsAndCalculations) {
             output.dispositionCard.financialIndicatorsAndCalculations = {};
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
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw e; 
        }
      }
      attempt++;
    }
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);

