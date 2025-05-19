
'use server';
/**
 * @fileOverview Verifies a DDU (Договор Долевого Участия) document against a user-provided checklist.
 *
 * - verifyDduAgainstChecklist - A function that handles the DDU verification.
 * - VerifyDduInput - The input type for the function.
 * - VerifyDduOutput - The return type for the function.
 * - VerifiedItem - The type for individual verified checklist items.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Buffer} from 'buffer'; // Not strictly needed if only PDF data URI is passed to Gemini

const ChecklistItemSchema = z.object({
  id: z.string().describe("Уникальный идентификатор пункта чек-листа."),
  text: z.string().min(1, "Текст пункта чек-листа не может быть пустым.").describe("Текст пункта чек-листа для проверки."),
});

const VerifyDduInputSchema = z.object({
  projectCompletionDate: z
    .string()
    .describe("Срок ввода объекта строительства в эксплуатацию (в формате ГГГГ-ММ-ДД)."),
  dduDocumentDataUri: z
    .string()
    .describe(
      "Проект договора долевого участия (ДДУ) в виде data URI. Ожидаемый формат: 'data:application/pdf;base64,<encoded_data>'."
    ),
  checklist: z.array(ChecklistItemSchema).min(1, "Чек-лист должен содержать хотя бы один пункт."),
});
export type VerifyDduInput = z.infer<typeof VerifyDduInputSchema>;

const VerifiedItemSchema = z.object({
  originalChecklistItemId: z.string().describe("ID исходного пункта чек-листа."),
  checklistItemText: z.string().describe("Текст проверенного пункта чек-листа."),
  status: z.enum(["соответствует", "не соответствует", "частично соответствует", "не удалось определить"])
    .describe("Статус соответствия пункта чек-листа содержимому ДДУ."),
  systemComment: z.string().optional().describe("Комментарий от AI, поясняющий статус, или цитата из ДДУ, если применимо."),
});
export type VerifiedItem = z.infer<typeof VerifiedItemSchema>;

const VerifyDduOutputSchema = z.object({
  verifiedItems: z.array(VerifiedItemSchema).describe("Список проверенных пунктов чек-листа с результатами."),
});
export type VerifyDduOutput = z.infer<typeof VerifyDduOutputSchema>;

// Internal schema for the prompt's input, as the DDU is media
const InternalVerifyDduPromptInputSchema = z.object({
  projectCompletionDate: z.string(),
  dduDocumentDataUri: z.string(), // The media URI
  checklistJson: z.string().describe("Чек-лист в формате JSON строки для передачи в промпт."), // Checklist items as a JSON string
});


export async function verifyDduAgainstChecklist(input: VerifyDduInput): Promise<VerifyDduOutput> {
  // Validate DDU data URI MIME type
  const dataUriParts = input.dduDocumentDataUri.match(/^data:(.+?);base64,(.*)$/);
  if (!dataUriParts || dataUriParts[1] !== 'application/pdf') {
    throw new Error('Неверный формат файла ДДУ. Ожидается PDF файл в формате data URI.');
  }
  
  return verifyDduFlow(input);
}

const prompt = ai.definePrompt({
  name: 'verifyDduPrompt',
  input: {schema: InternalVerifyDduPromptInputSchema}, // Use internal schema
  output: {schema: VerifyDduOutputSchema},
  prompt: `Вы — AI-ассистент, специализирующийся на проверке юридических документов, в частности, договоров долевого участия (ДДУ) в строительстве жилья на русском языке.

**Задача:** Проанализировать предоставленный проект ДДУ и проверить его на соответствие каждому пункту из предоставленного чек-листа.

**Контекстная информация:**
-   Срок ввода объекта строительства в эксплуатацию: {{{projectCompletionDate}}}

**Документ для анализа (Проект ДДУ):**
{{media url=dduDocumentDataUri}}

**Чек-лист для проверки (представлен в формате JSON):**
{{{checklistJson}}}

**Инструкции по проверке:**
Для каждого пункта из чек-листа:
1.  Внимательно изучите текст пункта чек-листа.
2.  Найдите в проекте ДДУ информацию, относящуюся к этому пункту.
3.  Определите статус соответствия ДДУ данному пункту чек-листа. Возможные статусы:
    *   "соответствует": Условие из чек-листа полностью и однозначно отражено в ДДУ.
    *   "не соответствует": Условие из чек-листа отсутствует в ДДУ или противоречит ему.
    *   "частично соответствует": Условие из чек-листа отражено в ДДУ не полностью, неоднозначно, или требует уточнений.
    *   "не удалось определить": В ДДУ недостаточно информации для однозначного ответа по данному пункту.
4.  Сформируйте краткий комментарий (systemComment), поясняющий ваш вывод. Если статус "соответствует" или "частично соответствует", и это уместно, приведите короткую цитату из ДДУ, подтверждающую это. Если "не соответствует" или "не удалось определить", кратко поясните причину.

**Формат вывода:**
Предоставьте результат в виде объекта JSON со свойством "verifiedItems". "verifiedItems" должен быть массивом объектов, где каждый объект соответствует одному пункту из исходного чек-листа и содержит следующие поля:
-   \`originalChecklistItemId\`: ID исходного пункта чек-листа.
-   \`checklistItemText\`: Полный текст исходного пункта чек-листа.
-   \`status\`: Один из статусов: "соответствует", "не соответствует", "частично соответствует", "не удалось определить".
-   \`systemComment\`: Ваш комментарий или цитата (опционально).

Убедитесь, что для КАЖДОГО пункта из предоставленного чек-листа есть соответствующий объект в массиве "verifiedItems".
Порядок элементов в "verifiedItems" должен соответствовать порядку пунктов в исходном чек-листе.
Вся текстовая информация в выводе должна быть на русском языке.
`,
});

const verifyDduFlow = ai.defineFlow(
  {
    name: 'verifyDduFlow',
    inputSchema: VerifyDduInputSchema, // External schema remains the same
    outputSchema: VerifyDduOutputSchema,
  },
  async (input: VerifyDduInput): Promise<VerifyDduOutput> => {
    
    const promptInputPayload: z.infer<typeof InternalVerifyDduPromptInputSchema> = {
      projectCompletionDate: input.projectCompletionDate,
      dduDocumentDataUri: input.dduDocumentDataUri,
      checklistJson: JSON.stringify(input.checklist, null, 2), // Convert checklist to JSON string for the prompt
    };

    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 2000; // Increased delay due to potentially larger documents & complex task
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const result = await prompt(promptInputPayload);
        const output = result.output;

        if (output && output.verifiedItems) {
           // Ensure all original checklist items are present in the output, even if AI missed some
           const finalVerifiedItems = input.checklist.map(originalItem => {
            const foundItem = output.verifiedItems.find(aiItem => aiItem.originalChecklistItemId === originalItem.id);
            if (foundItem) {
              return { // Ensure checklistItemText from AI output is used, or fallback to original if missing
                ...foundItem,
                checklistItemText: foundItem.checklistItemText || originalItem.text,
              };
            }
            // If AI missed an item, create a default entry
            return {
              originalChecklistItemId: originalItem.id,
              checklistItemText: originalItem.text,
              status: "не удалось определить" as const,
              systemComment: "AI не предоставил анализ для этого пункта.",
            };
          });
          return { verifiedItems: finalVerifiedItems };
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не вернул ожидаемый результат (verifiedItems) после нескольких попыток.');
        }

      } catch (e: any) {
        const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e);
        const isRetryableError = 
          errorMessage.includes('503') || // Service Unavailable
          errorMessage.includes('overloaded') || 
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('rate limit') || 
          errorMessage.includes('resource has been exhausted') || // Common for complex tasks
          errorMessage.includes('deadline exceeded') || // Timeout
          errorMessage.includes('internal error') ||
          errorMessage.includes('try again later') ||
          errorMessage.includes('429'); // HTTP 429 Too Many Requests
        
        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            throw new Error('Сервис временно перегружен или достигнут лимит запросов. Пожалуйста, попробуйте позже.');
          }
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`Retryable error for DDU verification. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-retryable error
          console.error("Non-retryable error in verifyDduFlow:", e);
          throw e; 
        }
      }
      attempt++;
    }
    // Fallback, should ideally not be reached.
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);

// Types are already exported above using z.infer, no need for the line below.
// export type { VerifyDduInputSchema, VerifiedItemSchema as VerifyDduVerifiedItemSchema, VerifyDduOutputSchema };

// Ensuring only types and the async function are exported for 'use server' compliance.
// The schema consts (VerifyDduInputSchema, etc.) are now module-local.
// The z.infer types (VerifyDduInput, VerifiedItem, VerifyDduOutput) ARE exported.
// The main function (verifyDduAgainstChecklist) IS exported.
