'use server';
/**
 * @fileOverview Analyzes a document to provide a summary and identify its type.
 *
 * - analyzeDocument - A function that handles the document analysis.
 * - AnalyzeDocumentInput - The input type for the analyzeDocument function.
 * - AnalyzeDocumentOutput - The return type for the analyzeDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Buffer} from 'buffer'; // Import Buffer

const AnalyzeDocumentInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The document content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  fileName: z.string().optional().describe('The original name of the file (e.g., contract.pdf). This can help provide context to the AI.'),
});
export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentInputSchema>;

const AnalyzeDocumentOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the document in Russian.'),
  documentType: z.string().describe('The identified type of the document in Russian (e.g., Договор, Справка, Заявление, Техническое задание).'),
});
export type AnalyzeDocumentOutput = z.infer<typeof AnalyzeDocumentOutputSchema>;


// Internal schema for the prompt's input, allowing for conditional processing
const InternalAnalyzeDocumentPromptInputSchema = z.object({
  documentDataUri: z.string().optional().describe("The document content as a data URI for media types like PDF/images."),
  fileName: z.string().optional().describe('The original name of the file.'),
  documentTextContent: z.string().optional().describe('Extracted text content of the document for text types.'),
  isMediaDocument: z.boolean().describe('True if documentDataUri points to a processable media type, false if documentTextContent should be used.'),
});


export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
  return analyzeDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {schema: InternalAnalyzeDocumentPromptInputSchema}, // Use internal schema
  output: {schema: AnalyzeDocumentOutputSchema},
  prompt: `Вы — AI-ассистент, специализирующийся на анализе документов. Ваша задача — проанализировать предоставленный документ, составить краткую сводку его содержания и определить тип документа.

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

Проанализируйте содержимое документа и предоставьте:
1.  **Краткая сводка**: Основные тезисы и суть документа на русском языке.
2.  **Тип документа**: Определите тип документа (например, Договор, Заявление, Техническое задание, Отчет, Презентация, Письмо и т.д.) на русском языке.

Убедитесь, что ваш ответ структурирован согласно указанным полям вывода.
`,
});

const analyzeDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeDocumentFlow',
    inputSchema: AnalyzeDocumentInputSchema, // External schema remains the same
    outputSchema: AnalyzeDocumentOutputSchema,
  },
  async (input: AnalyzeDocumentInput) => {
    const dataUriParts = input.documentDataUri.match(/^data:(.+?);base64,(.*)$/);
    if (!dataUriParts) {
      throw new Error('Invalid data URI format.');
    }
    const mimeType = dataUriParts[1];
    const base64Data = dataUriParts[2];

    const supportedMediaMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    const supportedTextMimeTypes = ['text/plain'];

    let promptInputPayload: z.infer<typeof InternalAnalyzeDocumentPromptInputSchema>;

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
      // General unsupported type message
      throw new Error(`Тип файла '${mimeType}' не поддерживается. Пожалуйста, загрузите файл в формате TXT, PDF или изображение (PNG, JPG, WebP).`);
    }

    const {output} = await prompt(promptInputPayload);
    if (!output) {
      throw new Error('AI did not return an output.');
    }
    return output;
  }
);
