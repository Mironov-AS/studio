
'use server';
/**
 * @fileOverview Finds tasks similar to a new one within an existing backlog.
 *
 * - findSimilarTasks - A function to find duplicate or similar tasks.
 * - FindSimilarTasksInput - The input type for the function.
 * - FindSimilarTasksOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const FindSimilarTasksInputSchema = z.object({
  newTaskDescription: z.string().describe('The description of the new task to be checked for duplicates.'),
  existingTasksJson: z.string().describe('A JSON string representing an array of existing tasks. Each task object should have at least an "id" and a "description" or "name" field.'),
});
export type FindSimilarTasksInput = z.infer<typeof FindSimilarTasksInputSchema>;

export const FindSimilarTasksOutputSchema = z.object({
  similarTaskIds: z.array(z.string()).describe('An array of IDs of existing tasks that are considered similar or duplicates.'),
  reasoning: z.string().describe('A brief explanation from the AI on why the tasks are considered similar, or a confirmation that no duplicates were found.'),
});
export type FindSimilarTasksOutput = z.infer<typeof FindSimilarTasksOutputSchema>;

export async function findSimilarTasks(input: FindSimilarTasksInput): Promise<FindSimilarTasksOutput> {
  return findSimilarTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findSimilarTasksPrompt',
  input: { schema: FindSimilarTasksInputSchema },
  output: { schema: FindSimilarTasksOutputSchema },
  prompt: `Ты — AI-ассистент, специализирующийся на анализе и дедупликации бэклога задач.
Твоя задача — проанализировать описание новой задачи и сравнить его с существующими задачами, чтобы найти возможные дубликаты или очень похожие по смыслу запросы.

**Новая задача для проверки:**
"{{{newTaskDescription}}}"

**Существующие задачи в бэклоге (в формате JSON):**
\`\`\`json
{{{existingTasksJson}}}
\`\`\`

**Инструкции:**
1.  Внимательно прочти описание новой задачи.
2.  Проанализируй каждую задачу из предоставленного JSON-списка существующих задач. Обращай внимание на поля, содержащие название и описание (например, "name", "title", "description", "цель").
3.  Определи, есть ли среди существующих задач такие, которые по своей сути, цели или конечному результату дублируют новую задачу. Сходство не обязательно должно быть дословным, важен семантический смысл.
4.  Если ты находишь одну или несколько похожих задач, верни массив их идентификаторов (из поля "id") в поле \`similarTaskIds\`.
5.  В поле \`reasoning\` дай краткое и четкое объяснение на русском языке, почему ты считаешь эти задачи похожими. Например: "Найдены похожие задачи, так как они обе направлены на оптимизацию процесса аутентификации пользователя."
6.  Если похожих задач не найдено, верни пустой массив \`similarTaskIds\` и в поле \`reasoning\` напиши "Похожих задач в бэклоге не найдено.".

Верни результат строго в формате JSON.
`,
});

const findSimilarTasksFlow = ai.defineFlow(
  {
    name: 'findSimilarTasksFlow',
    inputSchema: FindSimilarTasksInputSchema,
    outputSchema: FindSimilarTasksOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('AI не смог предоставить ответ для анализа на дубликаты.');
      }
      return output;
    } catch (e) {
      console.error("Error in findSimilarTasksFlow:", e);
      // Return a non-duplicate response in case of AI error to avoid blocking the user
      return {
        similarTaskIds: [],
        reasoning: "Не удалось выполнить проверку на дубликаты из-за внутренней ошибки AI.",
      };
    }
  }
);
