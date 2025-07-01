
'use server';
/**
 * @fileOverview Provides a chat interface to ask questions about a backlog of tasks/orders.
 *
 * - chatWithBacklog - A function that handles chatting with the backlog.
 * - ChatWithBacklogInput - The input type for the function.
 * - ChatWithBacklogOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const ChatWithBacklogInputSchema = z.object({
  userQuestion: z.string().min(1, "Вопрос не может быть пустым.").describe('The user’s question about the backlog.'),
  backlogJson: z.string().min(1, "Контекст бэклога не может быть пустым.").describe('The current backlog of tasks/orders as a JSON string.'),
});
export type ChatWithBacklogInput = z.infer<typeof ChatWithBacklogInputSchema>;

export const ChatWithBacklogOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user’s question based on the backlog.'),
});
export type ChatWithBacklogOutput = z.infer<typeof ChatWithBacklogOutputSchema>;


export async function chatWithBacklog(input: ChatWithBacklogInput): Promise<ChatWithBacklogOutput> {
  return chatWithBacklogFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithBacklogPrompt',
  input: { schema: ChatWithBacklogInputSchema },
  output: { schema: ChatWithBacklogOutputSchema },
  prompt: `Ты — AI-ассистент, встроенный в систему управления задачами подразделения. Твоя задача — отвечать на вопросы менеджера, основываясь ИСКЛЮЧИТЕЛЬНО на предоставленном списке текущих задач (бэклоге) в формате JSON. Не используй внешние знания и не делай предположений, выходящих за рамки предоставленных данных. Если ответ на вопрос отсутствует в данных, так и укажи.

Контекст (текущий бэклог задач):
\`\`\`json
{{{backlogJson}}}
\`\`\`

Вопрос пользователя:
"{{{userQuestion}}}"

Проанализируй JSON и ответь на вопрос пользователя. Будь кратким и точным.
`,
});

const chatWithBacklogFlow = ai.defineFlow(
  {
    name: 'chatWithBacklogFlow',
    inputSchema: ChatWithBacklogInputSchema,
    outputSchema: ChatWithBacklogOutputSchema,
  },
  async (input: ChatWithBacklogInput): Promise<ChatWithBacklogOutput> => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('AI не смог предоставить ответ по бэклогу.');
      }
      return output;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Неизвестная ошибка AI';
        console.error("Error in chatWithBacklogFlow:", e);
        return { answer: `Произошла ошибка при обработке вашего запроса: ${errorMessage}` };
    }
  }
);
