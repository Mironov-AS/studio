'use server';
/**
 * @fileOverview Extracts events with dates from a document.
 *
 * - extractDocumentEvents - A function that handles the event extraction.
 * - ExtractDocumentEventsInput - The input type for the extractDocumentEvents function.
 * - ExtractDocumentEventsOutput - The return type for the extractDocumentEvents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Buffer} from 'buffer';

const ExtractDocumentEventsInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The document content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  fileName: z.string().optional().describe('The original name of the file (e.g., report.pdf). This can help provide context to the AI.'),
});
export type ExtractDocumentEventsInput = z.infer<typeof ExtractDocumentEventsInputSchema>;

const EventSchema = z.object({
  date: z.string().describe("Дата события. Формат: ГГГГ-ММ-ДД, ДД.ММ.ГГГГ, или текстовое описание (например, 'Май 2023', 'В течение недели'). Если дата не найдена, может быть пустой строкой или 'Дата не указана'."),
  description: z.string().describe("Краткое описание события на русском языке."),
});

const ExtractDocumentEventsOutputSchema = z.object({
  events: z.array(EventSchema).describe('Список извлеченных событий из документа.'),
});
export type ExtractDocumentEventsOutput = z.infer<typeof ExtractDocumentEventsOutputSchema>;

// Internal schema for the prompt's input, allowing for conditional processing
const InternalExtractDocumentEventsPromptInputSchema = z.object({
  documentDataUri: z.string().optional().describe("The document content as a data URI for media types like PDF/images."),
  fileName: z.string().optional().describe('The original name of the file.'),
  documentTextContent: z.string().optional().describe('Extracted text content of the document for text types.'),
  isMediaDocument: z.boolean().describe('True if documentDataUri points to a processable media type, false if documentTextContent should be used.'),
});


export async function extractDocumentEvents(input: ExtractDocumentEventsInput): Promise<ExtractDocumentEventsOutput> {
  return extractDocumentEventsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDocumentEventsPrompt',
  input: {schema: InternalExtractDocumentEventsPromptInputSchema},
  output: {schema: ExtractDocumentEventsOutputSchema},
  prompt: `Вы — AI-ассистент, специализирующийся на извлечении структурированной информации из документов. Ваша задача — проанализировать предоставленный документ и найти все упоминания событий, сопровожденные датами или временными указаниями.

{{#if isMediaDocument}}
Документ для анализа (медиа):
{{media url=documentDataUri}}
{{else if documentTextContent}}
Документ для анализа (текст):
{{{documentTextContent}}}
{{else}}
[Инструкция для AI: Информация о документе не была предоставлена в ожидаемом медиа-формате или как извлеченный текст. Если имя файла доступно, попробуйте сделать предположение на его основе, но укажите на отсутствие содержимого. В противном случае, сообщите, что анализ невозможен.]
{{/if}}

{{#if fileName}}
Имя файла: {{{fileName}}}
{{/if}}

Проанализируйте содержимое документа и извлеките все события. Для каждого события укажите:
1.  **Дата события**: Укажите дату в формате ГГГГ-ММ-ДД, ДД.ММ.ГГГГ, или как текстовое описание временного промежутка (например, "Май 2023", "в течение следующей недели", "к концу года"). Если дату или временное указание невозможно определить, оставьте это поле пустым или укажите "Дата не указана".
2.  **Описание события**: Кратко опишите суть события на русском языке.

Предоставьте результат в виде массива объектов, где каждый объект представляет событие и содержит поля 'date' и 'description'. Убедитесь, что ваш ответ структурирован согласно указанным полям вывода для каждого события.
`,
});

const extractDocumentEventsFlow = ai.defineFlow(
  {
    name: 'extractDocumentEventsFlow',
    inputSchema: ExtractDocumentEventsInputSchema,
    outputSchema: ExtractDocumentEventsOutputSchema,
  },
  async (input: ExtractDocumentEventsInput) => {
    const dataUriParts = input.documentDataUri.match(/^data:(.+?);base64,(.*)$/);
    if (!dataUriParts) {
      throw new Error('Invalid data URI format.');
    }
    const mimeType = dataUriParts[1];
    const base64Data = dataUriParts[2];

    const supportedMediaMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    const supportedTextMimeTypes = ['text/plain'];

    let promptInputPayload: z.infer<typeof InternalExtractDocumentEventsPromptInputSchema>;

    if (supportedMediaMimeTypes.includes(mimeType)) {
      promptInputPayload = {
        documentDataUri: input.documentDataUri,
        fileName: input.fileName,
        isMediaDocument: true,
      };
    } else if (supportedTextMimeTypes.includes(mimeType)) {
      const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8');
      promptInputPayload = {
        documentTextContent: decodedText,
        fileName: input.fileName,
        isMediaDocument: false,
      };
    } else {
       if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
          throw new Error(`Файлы формата DOCX/DOC не поддерживаются для прямого анализа. Пожалуйста, сконвертируйте файл в PDF или TXT и загрузите снова.`);
      }
      throw new Error(`Тип файла '${mimeType}' не поддерживается. Пожалуйста, загрузите файл в формате TXT, PDF или изображение (PNG, JPG, WebP).`);
    }

    const {output} = await prompt(promptInputPayload);
    if (!output) {
      throw new Error('AI did not return an output.');
    }
    return output;
  }
);
