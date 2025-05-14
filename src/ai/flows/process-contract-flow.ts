
'use server';
/**
 * @fileOverview Processes contract documents to extract summary, parties, key events, and disposition card information.
 *
 * - processContract - A function that handles contract processing.
 * - ProcessContractInput - The input type for the processContract function.
 * - ProcessContractOutput - The return type for the processContract function.
 */

import {ai}from '@/ai/genkit';
import {z}from 'genkit';
import {Buffer}from 'buffer';

const PartySchema = z.object({
  name: z.string().describe('Полное наименование стороны договора (например, ООО "Ромашка", Иванов Иван Иванович).'),
  role: z.string().describe('Роль стороны в договоре (например, "Заказчик", "Исполнитель", "Банк", "Клиент", "Заемщик", "Кредитор").'),
});

const KeyEventSchema = z.object({
  date: z.string().describe("Дата или срок наступления события/выполнения обязательства (например, '2024-12-31', 'В течение 5 дней с даты подписания', 'Ежеквартально до 15 числа'). Если точная дата не указана, может быть текстовым описанием."),
  description: z.string().describe("Краткое описание события или обязательства на русском языке."),
  responsibleParty: z.string().optional().describe("Сторона, ответственная за выполнение (например, 'Банк', 'Клиент', или конкретное наименование стороны)."),
});

// DispositionCardSchema is now a local constant, not exported.
const DispositionCardSchema = z.object({
  contractNumber: z.string().optional().describe('Номер договора.'),
  contractDate: z.string().optional().describe('Дата заключения договора (ГГГГ-ММ-ДД или ДД.ММ.ГГГГ).'),
  partiesInfo: z.string().optional().describe('Наименования сторон договора (кратко, например, "Банк vs Клиент" или "ООО Ромашка и ИП Пупкин").'),
  objectInfo: z.string().optional().describe('Информация об объекте учёта или предмете договора.'),
  dealAmount: z.string().optional().describe('Сумма сделки или общая стоимость договора (с указанием валюты).'),
  startDate: z.string().optional().describe('Дата начала действия договора (ГГГГ-ММ-ДД или ДД.ММ.ГГГГ).'),
  bankExecutorName: z.string().optional().describe('ФИО ответственного исполнителя со стороны банка, если указано в договоре.'),
});

const ProcessContractInputSchema = z.object({
  documentDataUri: z
    .string()
    .optional()
    .describe(
      "Содержимое документа договора в виде data URI. Ожидаемый формат: 'data:<mimetype>;base64,<encoded_data>'. Используется, если не предоставлен documentText."
    ),
  documentText: z.string().optional().describe('Текст договора, введенный вручную. Используется, если не предоставлен documentDataUri.'),
  fileName: z.string().optional().describe('Оригинальное имя файла (например, contract.pdf). Помогает AI понять контекст.'),
  // existingContractId: z.string().optional().describe('ID существующего договора для сравнения версий и выявления изменений. (Функционал в разработке)'),
});
export type ProcessContractInput = z.infer<typeof ProcessContractInputSchema>;

const ProcessContractOutputSchema = z.object({
  contractSummary: z.string().describe('Краткая сводка содержания договора на русском языке.'),
  parties: z.array(PartySchema).describe('Список идентифицированных сторон договора.'),
  keyEvents: z.array(KeyEventSchema).describe('Список ключевых событий, сроков и обязательств, извлеченных из договора.'),
  dispositionCard: DispositionCardSchema.optional().describe('Данные для карточки "Распоряжение постановки на учет".'),
  identifiedChanges: z.string().optional().describe('Описание выявленных изменений по сравнению с предыдущей версией (если применимо). (Функционал в разработке)'),
  masterVersionText: z.string().optional().describe('Актуализированный полный текст договора с учетом всех дополнений (если применимо). (Функционал в разработке)'),
});
export type ProcessContractOutput = z.infer<typeof ProcessContractOutputSchema>;

// Internal schema for the prompt's input, allowing for conditional processing
const InternalProcessContractPromptInputSchema = z.object({
  documentDataUri: z.string().optional(),
  fileName: z.string().optional(),
  documentTextContent: z.string().optional(),
  isMediaDocument: z.boolean(),
  // existingContractContext: z.string().optional(), // For future version comparison
});


export async function processContract(input: ProcessContractInput): Promise<ProcessContractOutput> {
  return processContractFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processContractPrompt',
  input: {schema: InternalProcessContractPromptInputSchema},
  output: {schema: ProcessContractOutputSchema},
  prompt: `Вы — AI-ассистент, специализирующийся на анализе юридических документов, в частности договоров проектного финансирования на русском языке.
Ваша задача — тщательно проанализировать предоставленный текст или документ договора и извлечь следующую информацию:

{{#if isMediaDocument}}
Документ для анализа (медиа):
{{media url=documentDataUri}}
{{else if documentTextContent}}
Документ для анализа (текст):
{{{documentTextContent}}}
{{else}}
[Инструкция для AI: Информация о договоре не была предоставлена. Сообщите, что анализ невозможен без документа или текста.]
{{/if}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Проанализируйте документ и предоставьте:
1.  **Краткая сводка договора (contractSummary)**: Основная суть и предмет договора.
2.  **Стороны договора (parties)**: Массив объектов, где каждый объект содержит 'name' (полное наименование стороны) и 'role' (например, "Банк", "Клиент", "Заемщик", "Подрядчик").
3.  **Ключевые события и обязательства (keyEvents)**: Массив объектов, где каждый объект содержит 'date' (дата/срок), 'description' (описание события/обязательства) и 'responsibleParty' (ответственная сторона, если указана, например, "Банк" или "Клиент"). Ищите конкретные даты, сроки (например, "в течение X дней"), периодичность (например, "ежемесячно").
4.  **Данные для "Распоряжения о постановке на учет" (dispositionCard)**: Объект со следующими полями (если информация присутствует в договоре, иначе оставьте поля пустыми или не включайте их):
    *   'contractNumber': Номер договора.
    *   'contractDate': Дата заключения договора.
    *   'partiesInfo': Наименования сторон (кратко).
    *   'objectInfo': Информация об объекте учёта/предмете договора.
    *   'dealAmount': Сумма сделки/стоимость договора (с валютой).
    *   'startDate': Дата начала действия договора.
    *   'bankExecutorName': ФИО ответственного исполнителя со стороны банка.

{{!-- Функционал для сравнения версий и мастер-текста пока не реализуем в этом промпте
{{#if existingContractContext}}
Контекст предыдущей версии договора для сравнения:
{{{existingContractContext}}}
Проанализируйте также:
5.  **Выявленные изменения (identifiedChanges)**: Если предоставлен контекст предыдущей версии, опишите основные изменения.
6.  **Мастер-версия текста (masterVersionText)**: Сформируйте актуальный полный текст договора с учетом изменений.
{{/if}}
--}}

Убедитесь, что все текстовые описания и извлеченная информация на русском языке. Структурируйте ответ строго согласно указанным полям вывода.
Если какая-то информация отсутствует в документе, соответствующее поле в выводе должно быть пустым или отсутствовать (для опциональных полей в dispositionCard).
Для дат старайтесь приводить их к формату ГГГГ-ММ-ДД или ДД.ММ.ГГГГ, если возможно, или оставляйте текстовое описание срока.
`,
});

const processContractFlow = ai.defineFlow(
  {
    name: 'processContractFlow',
    inputSchema: ProcessContractInputSchema,
    outputSchema: ProcessContractOutputSchema,
  },
  async (input: ProcessContractInput): Promise<ProcessContractOutput> => {
    let promptInputPayload: z.infer<typeof InternalProcessContractPromptInputSchema>;

    if (input.documentDataUri) {
      const dataUriParts = input.documentDataUri.match(/^data:(.+?);base64,(.*)$/);
      if (!dataUriParts) {
        throw new Error('Неверный формат data URI для документа.');
      }
      const mimeType = dataUriParts[1];
      // const base64Data = dataUriParts[2]; // Not used directly here, but for context

      const supportedMediaMimeTypes = ['application/pdf']; // Gemini can handle PDF
      const supportedTextMimeTypes = ['text/plain']; // For .txt files uploaded

      if (supportedMediaMimeTypes.includes(mimeType)) {
        promptInputPayload = {
          documentDataUri: input.documentDataUri,
          fileName: input.fileName,
          isMediaDocument: true,
        };
      } else if (supportedTextMimeTypes.includes(mimeType)) {
         const base64Data = dataUriParts[2];
         const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8');
         promptInputPayload = {
            documentTextContent: decodedText,
            fileName: input.fileName,
            isMediaDocument: false,
         };
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
        throw new Error(`Файлы формата DOCX/DOC не поддерживаются для прямого анализа. Пожалуйста, сконвертируйте файл в PDF или TXT и загрузите снова, или вставьте текст вручную.`);
      } else {
        throw new Error(`Тип файла '${mimeType}' не поддерживается. Пожалуйста, загрузите файл в формате PDF или TXT, или вставьте текст вручную.`);
      }
    } else if (input.documentText) {
      promptInputPayload = {
        documentTextContent: input.documentText,
        fileName: input.fileName || 'manual_input.txt',
        isMediaDocument: false,
      };
    } else {
      throw new Error('Необходимо предоставить либо файл договора, либо его текст.');
    }

    // TODO: Implement version comparison logic if existingContractId is provided in future
    // if (input.existingContractId) {
    //   // Fetch existing contract data, prepare context for prompt
    //   // promptInputPayload.existingContractContext = "Контекст старого договора...";
    // }
    
    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 1000;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const result = await prompt(promptInputPayload);
        const output = result.output;

        if (output) {
          // Ensure dispositionCard is at least an empty object if not returned,
          // or fill with defaults if certain fields missing for consistency if needed by UI
          if (!output.dispositionCard) {
            output.dispositionCard = {}; // Or pre-fill with empty strings if schema expects them
          }
          return output;
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не вернул ожидаемый результат после нескольких попыток.');
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
          errorMessage.includes('internal error') ||
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

