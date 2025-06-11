
'use server';
/**
 * @fileOverview Processes user's text to extract reminder details.
 *
 * - processReminderRequest - Parses user text for reminder information.
 * - ProcessReminderRequestInput - Input type.
 * - ProcessReminderRequestOutput - Output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessReminderRequestInputSchema = z.object({
  userQuery: z.string().min(1, "Запрос не может быть пустым.").describe("Текстовый запрос пользователя для создания напоминания."),
});
export type ProcessReminderRequestInput = z.infer<typeof ProcessReminderRequestInputSchema>;

const ProcessReminderRequestOutputSchema = z.object({
  task: z.string().describe("Суть напоминания (что нужно сделать)."),
  dateTimeString: z.string().optional().describe("Распознанная дата и/или время события в текстовом виде (например, 'завтра в 10 утра', '25 декабря', 'через 2 часа'). Если не указано, будет пустым."),
  recurrenceString: z.string().optional().describe("Распознанная периодичность повторения в текстовом виде (например, 'каждый понедельник', 'ежедневно'). Если не указано, будет пустым."),
  originalQuery: z.string().describe("Оригинальный запрос пользователя."),
});
export type ProcessReminderRequestOutput = z.infer<typeof ProcessReminderRequestOutputSchema>;

export async function processReminderRequest(input: ProcessReminderRequestInput): Promise<ProcessReminderRequestOutput> {
  return processReminderRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processReminderRequestPrompt',
  input: {schema: ProcessReminderRequestInputSchema},
  output: {schema: ProcessReminderRequestOutputSchema},
  prompt: `Ты — AI-ассистент, который помогает создавать напоминания. Проанализируй запрос пользователя и извлеки из него суть задачи, дату/время и периодичность.

Пользовательский запрос: "{{{userQuery}}}"

Извлеки:
1.  **task**: Что именно нужно сделать? (например, "позвонить маме", "купить молоко", "подготовить отчет").
2.  **dateTimeString**: Когда это нужно сделать? Укажи это текстом, как в запросе (например, "завтра в 10:00", "после обеда", "25 декабря", "через 3 дня"). Если дата/время не указаны, оставь это поле пустым.
3.  **recurrenceString**: Если это повторяющееся событие, как часто оно повторяется? (например, "каждый день", "по вторникам", "раз в месяц"). Если не повторяется, оставь это поле пустым.

Верни результат в формате JSON, соответствующем ProcessReminderRequestOutputSchema.
Поле 'originalQuery' должно содержать исходный запрос пользователя.
`,
});

const processReminderRequestFlow = ai.defineFlow(
  {
    name: 'processReminderRequestFlow',
    inputSchema: ProcessReminderRequestInputSchema,
    outputSchema: ProcessReminderRequestOutputSchema,
  },
  async (input: ProcessReminderRequestInput) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI не смог обработать запрос на напоминание.');
    }
    return { ...output, originalQuery: input.userQuery };
  }
);
