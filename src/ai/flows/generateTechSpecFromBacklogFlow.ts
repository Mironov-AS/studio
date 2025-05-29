'use server';
/**
 * @fileOverview Generates a technical specification from a product backlog.
 *
 * - generateTechSpecFromBacklog - Function to generate the tech spec.
 * - GenerateTechSpecFromBacklogInput - Input type.
 * - GenerateTechSpecFromBacklogOutput - Output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTechSpecFromBacklogInputSchema = z.object({
  backlogDataJsonString: z
    .string()
    .describe(
      'A JSON string representing an array of backlog items. Each item is an object where keys are Excel column headers and values are cell content.'
    ),
  fileName: z.string().optional().describe('The original name of the Excel file for context.'),
});
export type GenerateTechSpecFromBacklogInput = z.infer<typeof GenerateTechSpecFromBacklogInputSchema>;

const GenerateTechSpecFromBacklogOutputSchema = z.object({
  techSpec: z.string().describe('The generated technical specification document in Russian.'),
});
export type GenerateTechSpecFromBacklogOutput = z.infer<typeof GenerateTechSpecFromBacklogOutputSchema>;

export async function generateTechSpecFromBacklog(
  input: GenerateTechSpecFromBacklogInput
): Promise<GenerateTechSpecFromBacklogOutput> {
  return generateTechSpecFromBacklogFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTechSpecFromBacklogPrompt',
  input: {schema: GenerateTechSpecFromBacklogInputSchema},
  output: {schema: GenerateTechSpecFromBacklogOutputSchema},
  prompt: `Ты — опытный системный аналитик и технический писатель. Твоя задача — проанализировать предоставленный бэклог продукта (переданный как JSON-строка, где каждый объект в массиве — это строка из Excel-файла с доработками) и подготовить на его основе техническое задание (ТЗ) на русском языке. Это ТЗ будет использоваться подрядчиком для оценки стоимости разработки.

Бэклог продукта (JSON-строка):
\`\`\`json
{{{backlogDataJsonString}}}
\`\`\`

{{#if fileName}}
Исходный файл: {{{fileName}}}
{{/if}}

Сгенерируй ТЗ, включающее следующие разделы:

1.  **Введение:**
    *   Краткое описание продукта или проекта, основанное на общем смысле бэклога.
    *   Основная цель создания/доработки продукта.

2.  **Цели и задачи проекта:**
    *   Перечисли основные цели, которые должны быть достигнуты (вывести из бэклога).
    *   Кратко опиши ключевые задачи для достижения этих целей.

3.  **Функциональные требования:**
    *   Для каждого элемента бэклога (каждой строки из предоставленного JSON) сформулируй четкое функциональное требование. Используй информацию из всех доступных полей элемента бэклога (например, "Название фичи", "Описание", "Пользовательская история", "Критерии приемки").
    *   Если есть информация о приоритетах или оценках, упомяни это.
    *   Сгруппируй схожие требования, если это уместно.

4.  **Нефункциональные требования (предложи общие, если в бэклоге нет специфики):**
    *   Производительность (например, время отклика, количество одновременных пользователей).
    *   Надежность (например, доступность системы, отказоустойчивость).
    *   Безопасность (например, защита данных, аутентификация, авторизация).
    *   Удобство использования (например, интуитивно понятный интерфейс, адаптивность).
    *   Масштабируемость.

5.  **Предполагаемый технологический стек (если не указано в бэклоге, предложи типовой для веб-приложения):**
    *   Например, Frontend, Backend, База данных.

6.  **Критерии приемки:**
    *   Общие критерии приемки для всего проекта.
    *   Если возможно, специфические критерии приемки для ключевых функциональных блоков, выведенные из бэклога.

7.  **Ожидаемые результаты:**
    *   Что должно быть получено по итогам разработки.

Формат ТЗ должен быть четким, структурированным и профессиональным. Избегай излишней детализации там, где информация отсутствует в бэклоге, но старайся сделать документ максимально полезным для подрядчика. Если в бэклоге есть заголовки колонок типа "ID", "Номер задачи", "Комментарий", "Ответственный", "Статус" - эту информацию можно использовать для лучшего понимания контекста фичи, но не обязательно дублировать в ТЗ, если она не несет прямой ценности для описания требования.
Сосредоточься на том, ЧТО система должна делать.
Выведи результат как единый текстовый документ.
`,
});

const generateTechSpecFromBacklogFlow = ai.defineFlow(
  {
    name: 'generateTechSpecFromBacklogFlow',
    inputSchema: GenerateTechSpecFromBacklogInputSchema,
    outputSchema: GenerateTechSpecFromBacklogOutputSchema,
  },
  async (input: GenerateTechSpecFromBacklogInput): Promise<GenerateTechSpecFromBacklogOutput> => {
    if (!input.backlogDataJsonString || input.backlogDataJsonString.trim() === '[]' || input.backlogDataJsonString.trim() === '{}') {
      return { techSpec: "Ошибка: Предоставленный бэклог пуст или некорректен. Пожалуйста, загрузите файл с данными." };
    }

    try {
      JSON.parse(input.backlogDataJsonString);
    } catch (e) {
      return { techSpec: "Ошибка: Не удалось обработать данные бэклога. Убедитесь, что это корректный JSON."};
    }
    
    const MAX_RETRIES = 2;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < MAX_RETRIES) {
        try {
            const {output} = await prompt(input);
            if (output && output.techSpec) {
                return output;
            }
            lastError = new Error('AI не смог сгенерировать техническое задание.');
        } catch (e) {
            lastError = e;
            console.error(`Attempt ${attempt + 1} failed for generateTechSpecFromBacklogFlow:`, e);
            if (attempt === MAX_RETRIES - 1) {
                 // If this was the last attempt, break to throw the error outside loop
                break;
            }
            // Optional: Add a delay before retrying if desired
            // await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
        attempt++;
    }
    
    let finalErrorMessage = `Не удалось сгенерировать ТЗ после ${MAX_RETRIES} попыток.`;
    if (lastError) {
        const message = lastError.message || (typeof lastError.toString === 'function' ? lastError.toString() : JSON.stringify(lastError, Object.getOwnPropertyNames(lastError)));
        finalErrorMessage += ` Последняя ошибка: ${message}`;
    }
    throw new Error(finalErrorMessage);
  }
);
