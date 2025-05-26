
'use server';
/**
 * @fileOverview Generates a product backlog with ICE scores from brainstorm session documents.
 *
 * - generateBacklogFromBrainstorm - Function to generate the backlog.
 * - GenerateBacklogInput - Input type.
 * - GenerateBacklogOutput - Output type.
 * - BacklogItem - Type for a single backlog item.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import { nanoid } from 'nanoid';

const BacklogItemSchema = z.object({
  id: z.string().describe("Уникальный идентификатор элемента бэклога (может быть сгенерирован)."),
  featureName: z.string().describe("Краткое, но понятное название фичи или доработки."),
  description: z.string().optional().describe("Более подробное описание сути фичи или проблемы, которую она решает."),
  userStory: z.string().optional().describe("Пользовательская история в формате 'Как <роль>, я хочу <действие>, чтобы <ценность>' (если применимо и можно извлечь)."),
  impact: z.number().min(1).max(10).describe("Оценка влияния на пользователя или бизнес (от 1 до 10)."),
  confidence: z.number().min(1).max(10).describe("Оценка уверенности в успехе или правильности гипотезы (от 1 до 10)."),
  ease: z.number().min(1).max(10).describe("Оценка легкости/сложности реализации (1 - очень сложно, 10 - очень легко)."),
  iceScore: z.number().describe("ICE-оценка (Impact * Confidence * Ease). Будет пересчитана на клиенте, но AI может дать первоначальное значение."),
});
export type BacklogItem = z.infer<typeof BacklogItemSchema>;

const GenerateBacklogInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "Документ с результатами брейншторма в виде data URI. Ожидаемый формат: 'data:application/pdf;base64,<encoded_data>'."
    ),
  fileName: z.string().optional().describe('Оригинальное имя PDF файла.'),
});
export type GenerateBacklogInput = z.infer<typeof GenerateBacklogInputSchema>;

const GenerateBacklogOutputSchema = z.object({
  backlogItems: z.array(BacklogItemSchema).describe("Список элементов бэклога, извлеченных и оцененных из документа."),
});
export type GenerateBacklogOutput = z.infer<typeof GenerateBacklogOutputSchema>;

export async function generateBacklogFromBrainstorm(input: GenerateBacklogInput): Promise<GenerateBacklogOutput> {
  return generateBacklogFromBrainstormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBacklogFromBrainstormPrompt',
  input: {schema: GenerateBacklogInputSchema},
  output: {schema: GenerateBacklogOutputSchema},
  prompt: `Ты — опытный продакт-менеджер и AI-аналитик. Твоя задача — проанализировать предоставленный PDF-документ с результатами брейншторм-сессии продуктовой команды на русском языке.
Из этого документа тебе нужно извлечь и структурировать информацию, чтобы сформировать первоначальный бэклог доработок или новых фич.

Для каждого идентифицированного элемента бэклога, пожалуйста, предоставь:
1.  **featureName**: Краткое, но емкое название фичи или доработки (например, "Улучшенный поиск по каталогу", "Интеграция с Telegram-ботом").
2.  **description** (опционально): Более развернутое описание сути фичи, проблемы, которую она решает, или ценности для пользователя.
3.  **userStory** (опционально): Если это возможно и уместно, сформулируй пользовательскую историю в формате "Как <роль>, я хочу <действие>, чтобы <ценность>". Если нет — оставь пустым.
4.  **impact**: Оцени потенциальное влияние этой фичи на пользователей или бизнес по шкале от 1 (минимальное) до 10 (максимальное).
5.  **confidence**: Оцени уверенность в том, что эта фича действительно нужна и принесет ожидаемый результат, по шкале от 1 (низкая) до 10 (высокая).
6.  **ease**: Оцени легкость реализации этой фичи по шкале от 1 (очень сложно, много времени и ресурсов) до 10 (очень легко, быстро реализуемо).
7.  **iceScore**: Рассчитай ICE-оценку как произведение Impact * Confidence * Ease.

Важно:
-   Сосредоточься на выявлении конкретных пользовательских нужд, проблем или предложенных решений, которые можно превратить в элементы бэклога.
-   Если в документе есть прямые указания на оценки ICE или их компоненты, используй их. Если нет, дай свою экспертную оценку на основе контекста.
-   Верни результат в виде массива объектов \`backlogItems\`. Каждый объект должен соответствовать структуре BacklogItemSchema.
-   Присвой каждому элементу уникальный \`id\` (можешь сгенерировать простой числовой или строковый идентификатор, например используя префикс 'item-' и случайное число).

Документ для анализа:
{{media url=documentDataUri}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Пожалуйста, сформируй бэклог максимально полно и точно на основе предоставленного документа.
`,
});

const generateBacklogFromBrainstormFlow = ai.defineFlow(
  {
    name: 'generateBacklogFromBrainstormFlow',
    inputSchema: GenerateBacklogInputSchema,
    outputSchema: GenerateBacklogOutputSchema,
  },
  async (input: GenerateBacklogInput): Promise<GenerateBacklogOutput> => {
    const dataUriParts = input.documentDataUri.match(/^data:(.+?);base64,(.*)$/);
    if (!dataUriParts || dataUriParts[1] !== 'application/pdf') {
      throw new Error('Неверный формат файла. Ожидается PDF файл в формате data URI.');
    }

    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 1500;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < MAX_RETRIES) {
      try {
        const { output } = await prompt(input);
        if (output && output.backlogItems) {
          const itemsWithIds = output.backlogItems.map((item, index) => ({
            ...item,
            id: item.id || nanoid(), // Use nanoid for unique IDs
            // Recalculate ICE score to ensure consistency, even if AI provides it
            iceScore: (item.impact || 1) * (item.confidence || 1) * (item.ease || 1), // Default to 1 if not provided
          }));
          return { backlogItems: itemsWithIds };
        }
        lastError = new Error('AI не вернул ожидаемый результат (backlogItems) после попытки ' + (attempt + 1));
        if (attempt === MAX_RETRIES - 1) {
          break;
        }
      } catch (e: any) {
        lastError = e;
        const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e);
        const isRetryableError =
          errorMessage.includes('503') || // Service Unavailable
          errorMessage.includes('overloaded') ||
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('resource has been exhausted') ||
          errorMessage.includes('deadline exceeded') ||
          errorMessage.includes('429');

        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            break;
          }
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Retryable error in generateBacklogFromBrainstormFlow. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error("Non-retryable error in generateBacklogFromBrainstormFlow:", e);
          throw e; 
        }
      }
      attempt++;
    }
     let finalErrorMessage = `Не удалось получить бэклог от AI после ${MAX_RETRIES} попыток.`;
    if (lastError) {
        const message = lastError.message || (typeof lastError.toString === 'function' ? lastError.toString() : JSON.stringify(lastError, Object.getOwnPropertyNames(lastError)));
        finalErrorMessage += ` Последняя ошибка: ${message}`;
    }
    console.error("[Flow] All retries failed for generateBacklogFromBrainstormFlow.", finalErrorMessage);
    throw new Error(finalErrorMessage);
  }
);
