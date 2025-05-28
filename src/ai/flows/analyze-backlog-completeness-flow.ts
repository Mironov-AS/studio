
'use server';
/**
 * @fileOverview Analyzes product backlog items for completeness and suggests content for missing fields.
 * Suggestions for User Story, Goal, and Acceptance Criteria are generated ONLY if the respective field is empty or missing in the input data for that item.
 * The AI bases its suggestions for an item SOLELY on the other available data within that specific item's rowData, without mixing information from other items.
 * The output array 'analyzedItems' MUST contain an entry for EACH item present in the input 'backlogItems'.
 * **Ты должен обработать КАЖДЫЙ элемент в этом списке и вернуть результат для КАЖДОГО.**
 *
 * - analyzeBacklogCompleteness - Function to analyze backlog items.
 * - AnalyzeBacklogCompletenessInput - Input type.
 * - AnalyzeBacklogCompletenessOutput - Output type.
 * - BacklogItemData - Type for a single input backlog item.
 * - BacklogAnalysisResult - Type for a single analyzed backlog item.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single backlog item received from the client
const BacklogItemDataSchema = z.object({
  id: z.string().describe("Уникальный идентификатор элемента бэклога (например, индекс строки или сгенерированный ID)."),
  rowData: z.record(z.string(), z.any()).describe("Данные всей строки из Excel как объект ключ-значение."),
});
export type BacklogItemData = z.infer<typeof BacklogItemDataSchema>;

// Schema for the entire input to the flow
const AnalyzeBacklogCompletenessInputSchema = z.object({
  backlogItems: z.array(BacklogItemDataSchema),
});
export type AnalyzeBacklogCompletenessInput = z.infer<typeof AnalyzeBacklogCompletenessInputSchema>;


// Schema for a single analyzed backlog item returned by the AI
const BacklogAnalysisResultSchema = z.object({
  id: z.string().describe("Уникальный идентификатор исходного элемента бэклога."),
  identifiedUserStory: z.string().optional().describe("Пользовательская история, извлеченная AI из rowData, если найдена. Если поле было изначально пустым, это поле тоже будет пустым."),
  suggestedUserStory: z.string().optional().describe("Предложенная формулировка пользовательской истории, если исходная была пустой, неполной или отсутствовала. Предложение должно содержать ТОЛЬКО текст истории."),
  identifiedGoal: z.string().optional().describe("Цель, извлеченная AI из rowData, если найдена."),
  suggestedGoal: z.string().optional().describe("Предложенная формулировка цели, если исходная была пустой, неполной или отсутствовала. Предложение должно содержать ТОЛЬКО текст цели."),
  identifiedAcceptanceCriteria: z.string().optional().describe("Критерии приемки, извлеченные AI из rowData, если найдены."),
  suggestedAcceptanceCriteria: z.string().optional().describe("Предложенная формулировка критериев приемки, если исходные были пустыми, неполными или отсутствовали. Предложение должно содержать ТОЛЬКО текст критериев."),
  analysisNotes: z.string().optional().describe("Краткий комментарий AI о сделанных предложениях или о полноте элемента на русском языке."),
});
export type BacklogAnalysisResult = z.infer<typeof BacklogAnalysisResultSchema>;

// Schema for the entire output of the flow
const AnalyzeBacklogCompletenessOutputSchema = z.object({
  analyzedItems: z.array(BacklogAnalysisResultSchema),
});
export type AnalyzeBacklogCompletenessOutput = z.infer<typeof AnalyzeBacklogCompletenessOutputSchema>;

// New schema for the prompt that processes a SINGLE backlog item
const SingleBacklogItemAnalysisPromptInputSchema = z.object({
    id: z.string(),
    rowDataJsonString: z.string().describe("The rowData of a single backlog item as a JSON string."),
});

export async function analyzeBacklogCompleteness(input: AnalyzeBacklogCompletenessInput): Promise<AnalyzeBacklogCompletenessOutput> {
  return analyzeBacklogCompletenessFlow(input);
}

const analyzeSingleItemPrompt = ai.definePrompt({
  name: 'analyzeSingleBacklogItemPrompt',
  input: {schema: SingleBacklogItemAnalysisPromptInputSchema},
  output: {schema: BacklogAnalysisResultSchema}, 
  prompt: `Ты — опытный Product Owner и Agile Coach. Твоя задача — проанализировать ОДИН элемент бэклога.
Элемент представлен через 'id' и 'rowDataJsonString' (данные строки из Excel в виде JSON строки).
В 'rowDataJsonString' (после его мысленного парсинга в объект) ищи поля, соответствующие "Пользовательская история", "Цель" и "Критерии приемки" (и их возможные вариации на русском языке, например, "User Story", "Цели", "Критерии готовности").

Для предоставленного элемента (ID: {{{id}}}):
1.  Извлеки существующие значения для "Пользовательской истории", "Цели" и "Критериев приемки" из данных в 'rowDataJsonString' и помести их в соответствующие поля \`identifiedUserStory\`, \`identifiedGoal\`, \`identifiedAcceptanceCriteria\`. Если поле в 'rowDataJsonString' отсутствует или пустое, оставь соответствующее \`identified\` поле пустым.
2.  Если какое-либо из этих трех полей ("Пользовательская история", "Цель", "Критерии приемки") в исходных данных (в 'rowDataJsonString') пустое, отсутствует или очевидно неполное (например, состоит из одного слова, содержит плейсхолдер типа "заполнить позже"), сгенерируй релевантное и краткое предложение для заполнения этого поля на русском языке. Помести эти предложения в поля \`suggestedUserStory\`, \`suggestedGoal\`, \`suggestedAcceptanceCriteria\` соответственно. ВАЖНО: Твои предложения для \`suggestedUserStory\`, \`suggestedGoal\` и \`suggestedAcceptanceCriteria\` должны содержать ТОЛЬКО саму формулировку соответствующего поля (истории, цели или критериев). Не включай в эти предложения никакую другую информацию, такую как сроки реализации, приоритеты, исполнителей и т.п. Предложения должны быть лаконичными и напрямую касаться только недостающего поля.
3.  При генерации предложений для "Пользовательской истории", "Цели", или "Критериев приемки" для этого элемента, основывайся ИСКЛЮЧИТЕЛЬНО на других заполненных полях в 'rowDataJsonString' ЭТОГО ЖЕ САМОГО элемента.
4.  Если поле ("Пользовательская история", "Цель", "Критерии приемки") уже хорошо заполнено в исходных данных, НЕ НУЖНО генерировать для него предложение (оставь соответствующее \`suggested\` поле пустым).
5.  Предоставь краткий комментарий \`analysisNotes\` на русском языке, объясняя, были ли сделаны предложения и почему (например, "Предложена цель, так как исходная была пустой. Пользовательская история и критерии приемки выглядят полными."), или указывая, что элемент выглядит полным и предложений не требуется.
6.  Убедись, что ВСЕ предложения и комментарии на РУССКОМ ЯЗЫКЕ.
7.  Обязательно верни исходный \`id\` элемента (переданный как {{{id}}}) в поле \`id\` ответного JSON объекта.

Пример JSON строки для 'rowDataJsonString':
\`\`\`json
{
  "Номер": 1,
  "Название задачи": "Регистрация нового пользователя",
  "Пользовательская история": "Как новый пользователь, я хочу зарегистрироваться в системе, чтобы получить доступ к её функциям.",
  "Цель": "",
  "Критерии приемки": "1. Форма регистрации открывается. 2. Введенные данные валидируются. 3. Пользователь успешно входит в систему после регистрации.",
  "Приоритет": "Высокий"
}
\`\`\`

Пример ожидаемого JSON объекта для указанной 'rowDataJsonString' и id="row_1":
\`\`\`json
{
  "id": "row_1",
  "identifiedUserStory": "Как новый пользователь, я хочу зарегистрироваться в системе, чтобы получить доступ к её функциям.",
  "suggestedUserStory": null,
  "identifiedGoal": null,
  "suggestedGoal": "Обеспечить возможность новым пользователям создавать учетные записи для доступа к функционалу платформы.",
  "identifiedAcceptanceCriteria": "1. Форма регистрации открывается. 2. Введенные данные валидируются. 3. Пользователь успешно входит в систему после регистрации.",
  "suggestedAcceptanceCriteria": null,
  "analysisNotes": "Предложена цель, так как исходная была пустой. Пользовательская история и критерии приемки выглядят полными."
}
\`\`\`

Входные данные для текущего анализа:
ID: {{{id}}}
rowDataJsonString: {{{rowDataJsonString}}}

Верни результат в виде ОДНОГО JSON объекта, соответствующего схеме вывода для одного элемента.
`,
});


const analyzeBacklogCompletenessFlow = ai.defineFlow(
  {
    name: 'analyzeBacklogCompletenessFlow',
    inputSchema: AnalyzeBacklogCompletenessInputSchema,
    outputSchema: AnalyzeBacklogCompletenessOutputSchema,
  },
  async (input: AnalyzeBacklogCompletenessInput): Promise<AnalyzeBacklogCompletenessOutput> => {
    if (!input.backlogItems || input.backlogItems.length === 0) {
      return { analyzedItems: [] };
    }

    const analyzedItems: BacklogAnalysisResult[] = [];
    const MAX_RETRIES_PER_ITEM = 2;
    const INITIAL_DELAY_MS_PER_ITEM = 1000;

    for (const item of input.backlogItems) {
      let attempt = 0;
      let itemProcessedSuccessfully = false;

      const promptPayload = {
        id: item.id,
        rowDataJsonString: JSON.stringify(item.rowData),
      };

      while (attempt < MAX_RETRIES_PER_ITEM) {
        let currentAttemptFailed = false;
        try {
          const { output } = await analyzeSingleItemPrompt(promptPayload);
          if (output) {
            // Ensure the returned ID matches the input ID
            analyzedItems.push({ ...output, id: item.id });
            itemProcessedSuccessfully = true;
            break; // Exit retry loop for this item
          } else {
            // Output is null/undefined, but no error was thrown.
            console.warn(`AI returned null/undefined output for item ${item.id} on attempt ${attempt + 1}.`);
            currentAttemptFailed = true;
          }
        } catch (e: any) {
          currentAttemptFailed = true; // Mark as failed if an error is caught
          const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e, Object.getOwnPropertyNames(e));
          const isRetryableError =
            errorMessage.includes('503') || // Service Unavailable
            errorMessage.includes('overloaded') ||
            errorMessage.includes('service unavailable') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('resource has been exhausted') ||
            errorMessage.includes('deadline exceeded') ||
            errorMessage.includes('429');

          if (isRetryableError) {
            console.warn(`Retryable error for item ${item.id} on attempt ${attempt + 1}. Error: ${errorMessage}`);
            // Will proceed to delay and retry if attempts left
          } else {
            console.error(`Non-retryable error for item ${item.id}:`, e);
            break; // Exit retry loop for this item, itemProcessedSuccessfully remains false
          }
        }

        if (currentAttemptFailed) {
          attempt++; // Increment attempt count
          if (attempt < MAX_RETRIES_PER_ITEM) {
            const delay = INITIAL_DELAY_MS_PER_ITEM * Math.pow(2, attempt -1 ); // attempt-1 for exponential backoff for the *next* attempt
            console.warn(`Retrying item ${item.id} in ${delay / 1000}s... (Next attempt will be ${attempt + 1}/${MAX_RETRIES_PER_ITEM})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // Max retries reached after a failed attempt
            console.warn(`Max retries reached for item ${item.id} after failed attempt ${attempt}.`);
            break; // Exit retry loop
          }
        }
      } // End of while loop

      if (!itemProcessedSuccessfully) {
        analyzedItems.push({
          id: item.id,
          identifiedUserStory: undefined,
          suggestedUserStory: undefined,
          identifiedGoal: undefined,
          suggestedGoal: undefined,
          identifiedAcceptanceCriteria: undefined,
          suggestedAcceptanceCriteria: undefined,
          analysisNotes: `AI не смог обработать этот элемент бэклога (ID: ${item.id}).`,
        });
      }
    }
    return { analyzedItems };
  }
);

