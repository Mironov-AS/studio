
'use server';
/**
 * @fileOverview Analyzes product backlog items for completeness and suggests content for missing fields.
 * Suggestions for User Story, Goal, and Acceptance Criteria are generated ONLY if the respective field is empty or missing in the input data for that item.
 * The AI bases its suggestions for an item SOLELY on the other available data within that specific item's rowData, without mixing information from other items.
 * Generated suggestions should ONLY contain the formulation for the specific field (User Story, Goal, or Acceptance Criteria) and no other extraneous information.
 * The output array 'analyzedItems' MUST contain an entry for EACH item present in the input 'backlogItemsJsonString'.
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

// Schema for the prompt input, with backlogItems pre-stringified
const AnalyzeBacklogCompletenessPromptInputSchema = z.object({
    backlogItemsJsonString: z.string().describe("The backlog items as a JSON string."),
  });

export async function analyzeBacklogCompleteness(input: AnalyzeBacklogCompletenessInput): Promise<AnalyzeBacklogCompletenessOutput> {
  return analyzeBacklogCompletenessFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeBacklogCompletenessPrompt',
  input: {schema: AnalyzeBacklogCompletenessPromptInputSchema}, // Use the schema with pre-stringified JSON
  output: {schema: AnalyzeBacklogCompletenessOutputSchema}, 
  prompt: `Ты — опытный Product Owner и Agile Coach. Твоя задача — проанализировать список элементов бэклога, представленных как JSON-строка. Каждый объект в этой строке содержит 'id' и 'rowData' (данные строки из Excel).
В 'rowData' ищи поля, соответствующие "Пользовательская история", "Цель" и "Критерии приемки" (и их возможные вариации на русском языке, например, "User Story", "Цели", "Критерии готовности").

Для КАЖДОГО элемента из JSON-строки \`backlogItemsJsonString\`:
1.  Извлеки существующие значения для "Пользовательской истории", "Цели" и "Критериев приемки" из \`rowData\` и помести их в соответствующие поля \`identifiedUserStory\`, \`identifiedGoal\`, \`identifiedAcceptanceCriteria\`. Если поле в \`rowData\` отсутствует или пустое, оставь соответствующее \`identified\` поле пустым.
2.  Если какое-либо из этих трех полей ("Пользовательская история", "Цель", "Критерии приемки") в исходных данных (\`rowData\`) пустое, отсутствует или очевидно неполное (например, состоит из одного слова, содержит плейсхолдер типа "заполнить позже"), сгенерируй релевантное и краткое предложение для заполнения этого поля на русском языке. Помести эти предложения в поля \`suggestedUserStory\`, \`suggestedGoal\`, \`suggestedAcceptanceCriteria\` соответственно. ВАЖНО: Твои предложения для \`suggestedUserStory\`, \`suggestedGoal\` и \`suggestedAcceptanceCriteria\` должны содержать ТОЛЬКО саму формулировку соответствующего поля (истории, цели или критериев). Не включай в эти предложения никакую другую информацию, такую как сроки реализации, приоритеты, исполнителей и т.п. Предложения должны быть лаконичными и напрямую касаться только недостающего поля.
3.  При генерации предложений для "Пользовательской истории", "Цели", или "Критериев приемки" для конкретного элемента, основывайся ИСКЛЮЧИТЕЛЬНО на других заполненных полях (\`rowData\`) ЭТОГО ЖЕ САМОГО элемента. НЕ ИСПОЛЬЗУЙ информацию из других элементов бэклога для генерации предложений для полей текущего элемента.
4.  Если поле ("Пользовательская история", "Цель", "Критерии приемки") уже хорошо заполнено в исходных данных, НЕ НУЖНО генерировать для него предложение (оставь соответствующее \`suggested\` поле пустым).
5.  Предоставь краткий комментарий \`analysisNotes\` на русском языке для каждого элемента, объясняя, были ли сделаны предложения и почему (например, "Предложена цель, так как исходная была пустой. Пользовательская история и критерии приемки выглядят полными."), или указывая, что элемент выглядит полным и предложений не требуется.
6.  Убедись, что ВСЕ предложения и комментарии на РУССКОМ ЯЗЫКЕ.
7.  Сохрани исходный \`id\` элемента в ответном объекте.

Пример массива входных элементов в JSON-строке \`backlogItemsJsonString\` (представлен здесь как объект для ясности, но в промпт будет передана строка):
\`\`\`json
[
  {
    "id": "row_1",
    "rowData": {
      "Номер": 1,
      "Название задачи": "Регистрация нового пользователя",
      "Пользовательская история": "Как новый пользователь, я хочу зарегистрироваться в системе, чтобы получить доступ к её функциям.",
      "Цель": "",
      "Критерии приемки": "1. Форма регистрации открывается. 2. Введенные данные валидируются. 3. Пользователь успешно входит в систему после регистрации.",
      "Приоритет": "Высокий"
    }
  },
  {
    "id": "row_2",
    "rowData": {
      "Номер": 2,
      "Название задачи": "Поиск товара",
      "Пользовательская история": "",
      "Цель": "Пользователь должен иметь возможность быстро находить товары по названию или категории.",
      "Критерии приемки": "1. Поисковая строка доступна на главной странице. 2. Результаты поиска релевантны запросу. 3. Фильтрация по категориям работает.",
      "Приоритет": "Средний"
    }
  }
]
\`\`\`

Пример ожидаемого массива \`analyzedItems\` для указанного входа:
\`\`\`json
{
  "analyzedItems": [
    {
      "id": "row_1",
      "identifiedUserStory": "Как новый пользователь, я хочу зарегистрироваться в системе, чтобы получить доступ к её функциям.",
      "suggestedUserStory": null,
      "identifiedGoal": null,
      "suggestedGoal": "Обеспечить возможность новым пользователям создавать учетные записи для доступа к функционалу платформы.",
      "identifiedAcceptanceCriteria": "1. Форма регистрации открывается. 2. Введенные данные валидируются. 3. Пользователь успешно входит в систему после регистрации.",
      "suggestedAcceptanceCriteria": null,
      "analysisNotes": "Предложена цель, так как исходная была пустой. Пользовательская история и критерии приемки выглядят полными."
    },
    {
      "id": "row_2",
      "identifiedUserStory": null,
      "suggestedUserStory": "Как покупатель, я хочу легко находить нужные товары, чтобы сэкономить время на покупках.",
      "identifiedGoal": "Пользователь должен иметь возможность быстро находить товары по названию или категории.",
      "suggestedGoal": null,
      "identifiedAcceptanceCriteria": "1. Поисковая строка доступна на главной странице. 2. Результаты поиска релевантны запросу. 3. Фильтрация по категориям работает.",
      "suggestedAcceptanceCriteria": null,
      "analysisNotes": "Предложена пользовательская история, т.к. исходная была пустой. Цель и критерии приемки выглядят полными."
    }
  ]
}
\`\`\`

Входные данные (JSON-строка backlogItemsJsonString):
{{{backlogItemsJsonString}}}

Верни результат в виде объекта JSON со свойством "analyzedItems". Убедись, что массив "analyzedItems" содержит запись для КАЖДОГО элемента из входного JSON.
`,
});


const analyzeBacklogCompletenessFlow = ai.defineFlow(
  {
    name: 'analyzeBacklogCompletenessFlow',
    inputSchema: AnalyzeBacklogCompletenessInputSchema, // Flow input remains the same
    outputSchema: AnalyzeBacklogCompletenessOutputSchema,
  },
  async (input: AnalyzeBacklogCompletenessInput): Promise<AnalyzeBacklogCompletenessOutput> => {
    if (!input.backlogItems || input.backlogItems.length === 0) {
      return { analyzedItems: [] };
    }

    // Prepare payload for the prompt by stringifying backlogItems
    const promptPayload = {
      backlogItemsJsonString: JSON.stringify(input.backlogItems),
    };

    const MAX_RETRIES = 2;
    const INITIAL_DELAY_MS = 1000;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        // Pass the stringified payload to the prompt
        const { output } = await prompt(promptPayload); 
        if (output && output.analyzedItems) {
          // Ensure all original items have a corresponding analyzed item, even if AI fails for some
          const finalAnalyzedItems = input.backlogItems.map(originalItem => {
            const foundAnalyzed = output.analyzedItems.find(aiItem => aiItem.id === originalItem.id);
            if (foundAnalyzed) {
              return foundAnalyzed;
            }
            // If AI completely missed an item, return a default structure
            return {
              id: originalItem.id,
              analysisNotes: "AI не смог обработать этот элемент бэклога.",
            };
          });
          return { analyzedItems: finalAnalyzedItems };
        }
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не вернул ожидаемый результат (analyzedItems) после нескольких попыток.');
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
          errorMessage.includes('429');

        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            throw new Error('Сервис временно перегружен или достигнут лимит запросов. Пожалуйста, попробуйте позже.');
          }
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Retryable error in analyzeBacklogCompletenessFlow. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error("Non-retryable error in analyzeBacklogCompletenessFlow:", e);
          throw e;
        }
      }
      attempt++;
    }
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);

