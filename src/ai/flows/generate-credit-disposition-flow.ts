
'use server';
/**
 * @fileOverview Generates a credit agreement disposition card.
 *
 * - generateCreditDisposition - Function to handle credit disposition generation.
 * - GenerateCreditDispositionInput - Input type for the function.
 * - GenerateCreditDispositionOutput - Output type for the function.
 * - CreditDispositionCardData - The type for the disposition card data.
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

// Made local: Zod schema for the disposition card. Not exported as an object.
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
  sublimitVolumeAndAvailability: z.number().optional().describe('Отдельные лимиты внутри общего объема кредита (число).'),
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное']).optional().describe('Соответствие нормам Центрального банка.'),
  dispositionExecutorName: z.string().optional().describe('ФИО сотрудника, подготовившего распоряжение.'),
  authorizedSignatory: z.string().optional().describe('Лицо, имеющее полномочия подписи (ФИО).'),
});
export type CreditDispositionCardData = z.infer<typeof CreditDispositionCardSchema>;

const GenerateCreditDispositionOutputSchema = z.object({
  dispositionCard: CreditDispositionCardSchema,
});
export type GenerateCreditDispositionOutput = z.infer<typeof GenerateCreditDispositionOutputSchema>;


export async function generateCreditDisposition(input: GenerateCreditDispositionInput): Promise<GenerateCreditDispositionOutput> {
  return generateCreditDispositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCreditDispositionPrompt',
  input: { schema: GenerateCreditDispositionInputSchema },
  output: { schema: GenerateCreditDispositionOutputSchema }, // This uses the internal CreditDispositionCardSchema definition
  prompt: `Вы — AI-ассистент, специализирующийся на анализе кредитных договоров на русском языке.
Ваша задача — тщательно проанализировать предоставленный PDF-документ кредитного договора и извлечь информацию для формирования "Распоряжения о постановке на учет".

Документ для анализа (кредитный договор в формате PDF):
{{media url=documentDataUri}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Проанализируйте документ и извлеките следующие атрибуты. Если какой-то атрибут отсутствует в договоре или не может быть однозначно определен, оставьте соответствующее поле пустым или со значением по умолчанию (например, false для boolean, пустой массив для dateArray). Даты должны быть в формате ГГГГ-ММ-ДД.

Извлеките следующие данные для dispositionCard:
- statementNumber: Уникальный идентификатор заявки (если есть).
- statementDate: Дата заявления (ГГГГ-ММ-ДД, если есть).
- borrowerName: Полное юридическое название заемщика.
- borrowerInn: ИНН заемщика.
- contractNumber: Номер подписанного кредитного договора.
- contractDate: Дата подписания договора (ГГГГ-ММ-ДД).
- creditType: Тип кредита (одно из: "Кредитная линия", "Возобновляемая кредитная линия").
- limitCurrency: Валюта кредитного лимита (например, RUB, USD, EUR).
- contractAmount: Общая сумма кредита (число).
- borrowerAccountNumber: Банковский расчётный счёт заемщика.
- enterpriseCategory: Признак субъекта МСП (одно из: "Среднее", "Малое", "Микро").
- creditCommitteeDecision: Есть решение кредитного комитета (true или false).
- subsidyAgent: Организация, предоставляющая субсидии (если есть).
- notesAndSpecialConditions: Любые дополнительные замечания и особые условия.
- assetBusinessModel: Оценка модели управления активом (одно из: "Удерживать для продажи", "Иное").
- marketTransaction: Определение рыночного характера операции (одно из: "Да", "Нет", "Не применимо").
- commissionRate: Размер комиссионных сборов (число, например, 1.5 для 1.5%).
- commissionPaymentSchedule: Список дат оплаты комиссий (массив строк в формате ГГГГ-ММ-ДД).
- earlyRepaymentAllowed: Разрешено ли частичное/досрочное погашение (true или false).
- notificationPeriodDays: Количество дней для уведомления кредитора (целое число).
- earlyRepaymentMoratorium: Запрет на досрочное погашение (true или false).
- penaltyRate: Величина штрафа за просрочку платежа (в процентах, число, например, 0.1 для 0.1%).
- penaltyIndexation: Применяется ли увеличение размера неустойки (true или false).
- sublimitVolumeAndAvailability: Отдельные лимиты внутри общего объема кредита (число, если есть).
- finalCreditQualityCategory: Итоговая категория качества кредита (одно из: "Хорошее", "Проблемное", "Просроченное").
- dispositionExecutorName: ФИО сотрудника, подготовившего распоряжение (если указано в контексте документа).
- authorizedSignatory: Лицо, имеющее полномочия подписи от банка (если указано в контексте документа, ФИО).

Убедитесь, что все текстовые описания и извлеченная информация на русском языке, где это применимо (например, названия, примечания).
Структурируйте ответ строго согласно указанным полям вывода в объекте 'dispositionCard'.
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
    const INITIAL_DELAY_MS = 1500; // Slightly increased delay for potentially complex PDF parsing
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const result = await prompt(input); // Pass the original input with documentDataUri
        const output = result.output;

        if (output && output.dispositionCard) {
          // Basic validation or transformation can happen here if needed
          // For example, ensuring dates are in a consistent string format if not already Date objects
          // For now, we rely on the schema and prompt for correct formatting.
          return output;
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не вернул ожидаемый результат (dispositionCard) после нескольких попыток.');
        }

      } catch (e: any) {
        const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e);
        const isRetryableError = 
          errorMessage.includes('503') || // Service Unavailable
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
          throw e; // Non-retryable error
        }
      }
      attempt++;
    }
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);

