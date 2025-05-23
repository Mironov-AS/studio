
'use server';
/**
 * @fileOverview Provides a chat interface to ask questions about a document.
 *
 * - chatWithDocument - A function that handles chatting with the document.
 * - ChatWithDocumentInput - The input type for the chatWithDocument function.
 * - ChatWithDocumentOutput - The return type for the chatWithDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Buffer}from 'buffer';

const ChatWithDocumentInputSchema = z.object({
  documentContextUri: z
    .string()
    .optional()
    .describe(
      "The document content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'. Used if documentContextText is not provided."
    ),
  documentContextText: z.string().optional().describe('The plain text content of the document. Used if documentContextUri is not provided.'),
  fileName: z.string().optional().describe('The original name of the file (e.g., contract.pdf). This can help provide context to the AI.'),
  userQuestion: z.string().min(1, "Вопрос не может быть пустым.").describe('The user_s question about the document.'),
});
export type ChatWithDocumentInput = z.infer<typeof ChatWithDocumentInputSchema>;

const ChatWithDocumentOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user_s question based on the document.'),
});
export type ChatWithDocumentOutput = z.infer<typeof ChatWithDocumentOutputSchema>;

// Internal schema for the prompt's input, allowing for conditional processing
const InternalChatPromptInputSchema = z.object({
  documentDataUriForMedia: z.string().optional().describe("The document content as a data URI for media types like PDF/images."),
  fileName: z.string().optional().describe('The original name of the file.'),
  documentTextContent: z.string().optional().describe('Extracted text content of the document for text types or manually entered text.'),
  isMediaDocument: z.boolean().describe('True if documentDataUriForMedia should be used, false if documentTextContent should be used.'),
  userQuestion: z.string(),
});


export async function chatWithDocument(input: ChatWithDocumentInput): Promise<ChatWithDocumentOutput> {
  return chatWithDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithDocumentPrompt',
  input: {schema: InternalChatPromptInputSchema},
  output: {schema: ChatWithDocumentOutputSchema},
  prompt: `Ты — AI-ассистент, специализирующийся на ответах на вопросы по содержанию предоставленного юридического документа на русском языке. Твоя задача — отвечать на вопросы пользователя, основываясь ИСКЛЮЧИТЕЛЬНО на информации, содержащейся в этом документе. Не используй внешние знания и не делай предположений, выходящих за рамки текста документа. Если ответ на вопрос отсутствует в документе, так и укажи.

{{#if isMediaDocument}}
Документ для анализа (медиа):
{{media url=documentDataUriForMedia}}
{{else if documentTextContent}}
Документ для анализа (текст):
{{{documentTextContent}}}
{{else}}
[Инструкция для AI: Контекст документа не был предоставлен. Сообщи, что ответ невозможен без документа.]
{{/if}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Вопрос пользователя:
{{{userQuestion}}}

Ответь на вопрос пользователя, опираясь строго на предоставленный документ.
`,
});

const chatWithDocumentFlow = ai.defineFlow(
  {
    name: 'chatWithDocumentFlow',
    inputSchema: ChatWithDocumentInputSchema,
    outputSchema: ChatWithDocumentOutputSchema,
  },
  async (input: ChatWithDocumentInput): Promise<ChatWithDocumentOutput> => {
    let promptInputPayload: z.infer<typeof InternalChatPromptInputSchema>;

    if (!input.documentContextUri && !input.documentContextText) {
      throw new Error('Необходимо предоставить либо URI документа, либо его текст для чата.');
    }

    if (input.documentContextUri) {
      const dataUriParts = input.documentContextUri.match(/^data:(.+?);base64,(.*)$/);
      if (!dataUriParts) {
        throw new Error('Неверный формат data URI для документа в чате.');
      }
      const mimeType = dataUriParts[1];
      const base64Data = dataUriParts[2];

      const supportedMediaMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
      const supportedTextMimeTypes = ['text/plain'];

      if (supportedMediaMimeTypes.includes(mimeType)) {
        promptInputPayload = {
          documentDataUriForMedia: input.documentContextUri,
          fileName: input.fileName,
          isMediaDocument: true,
          userQuestion: input.userQuestion,
        };
      } else if (supportedTextMimeTypes.includes(mimeType)) {
         const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8');
         promptInputPayload = {
            documentTextContent: decodedText,
            fileName: input.fileName,
            isMediaDocument: false,
            userQuestion: input.userQuestion,
         };
      } else {
        // Fallback for unsupported URI types: try to treat as text if text context is also missing
        if (input.documentContextText) {
            promptInputPayload = {
                documentTextContent: input.documentContextText,
                fileName: input.fileName,
                isMediaDocument: false,
                userQuestion: input.userQuestion,
            };
        } else {
            throw new Error(`Тип файла '${mimeType}' из data URI не поддерживается для чата, и текстовый контекст не предоставлен.`);
        }
      }
    } else { // Only documentContextText is provided
      promptInputPayload = {
        documentTextContent: input.documentContextText,
        fileName: input.fileName,
        isMediaDocument: false,
        userQuestion: input.userQuestion,
      };
    }
    
    const MAX_RETRIES = 2; // Fewer retries for chat as it's interactive
    const INITIAL_DELAY_MS = 1000;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const result = await prompt(promptInputPayload);
        const output = result.output;

        if (output && output.answer) {
          return output;
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не смог предоставить ответ на ваш вопрос после нескольких попыток.');
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
          // errorMessage.includes('internal error') || // Let's not retry internal errors for chat too often
          errorMessage.includes('try again later') ||
          errorMessage.includes('429');
        
        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            throw new Error('Сервис временно перегружен или достигнут лимит запросов. Пожалуйста, попробуйте позже.');
          }
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw e; // Non-retryable error
        }
      }
      attempt++;
    }
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);

