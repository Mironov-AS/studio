
'use server';
/**
 * @fileOverview Generates architectural sketches based on a technical specification document.
 *
 * - generateArchitecturalSketches - A function that handles the sketch generation.
 * - GenerateArchitecturalSketchesInput - The input type for the function.
 * - GenerateArchitecturalSketchesOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Buffer} from 'buffer';

const GenerateArchitecturalSketchesInputSchema = z.object({
  techSpecDataUri: z
    .string()
    .describe(
      "The technical specification document as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  fileName: z.string().optional().describe('The original name of the file (e.g., tech_spec.pdf). This can help provide context to the AI.'),
});
export type GenerateArchitecturalSketchesInput = z.infer<typeof GenerateArchitecturalSketchesInputSchema>;

const GenerateArchitecturalSketchesOutputSchema = z.object({
  imageUrl: z.string().describe('A data URI of the generated image containing architectural sketches. Expected format: \'data:image/png;base64,<encoded_data>\'.'),
});
export type GenerateArchitecturalSketchesOutput = z.infer<typeof GenerateArchitecturalSketchesOutputSchema>;

export async function generateArchitecturalSketches(input: GenerateArchitecturalSketchesInput): Promise<GenerateArchitecturalSketchesOutput> {
  return generateArchitecturalSketchesFlow(input);
}

const generateArchitecturalSketchesFlow = ai.defineFlow(
  {
    name: 'generateArchitecturalSketchesFlow',
    inputSchema: GenerateArchitecturalSketchesInputSchema,
    outputSchema: GenerateArchitecturalSketchesOutputSchema,
  },
  async (input: GenerateArchitecturalSketchesInput): Promise<GenerateArchitecturalSketchesOutput> => {
    const dataUriParts = input.techSpecDataUri.match(/^data:(.+?);base64,(.*)$/);
    if (!dataUriParts) {
      throw new Error('Invalid data URI format for technical specification.');
    }
    const mimeType = dataUriParts[1];
    const base64Data = dataUriParts[2];

    const supportedMediaMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    const supportedTextMimeTypes = ['text/plain'];

    let promptPayloadElements: ({text: string} | {media: {url: string, mimeType?: string}})[] = [];


    if (supportedMediaMimeTypes.includes(mimeType)) {
      promptPayloadElements.push({text: "Проанализируй следующее техническое задание (представлено как медиа-файл):"});
      promptPayloadElements.push({media: {url: input.techSpecDataUri, mimeType: mimeType }});

    } else if (supportedTextMimeTypes.includes(mimeType)) {
      const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8');
      promptPayloadElements.push({text: "Проанализируй следующее техническое задание (представлено как текст):"});
      promptPayloadElements.push({text: decodedText});
    } else {
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
          throw new Error(`Файлы формата DOCX/DOC не поддерживаются для прямого анализа. Пожалуйста, сконвертируйте файл в PDF или TXT и загрузите снова.`);
      }
      throw new Error(`Тип файла '${mimeType}' не поддерживается. Пожалуйста, загрузите файл в формате TXT, PDF или изображение (PNG, JPG, WebP).`);
    }
    
    promptPayloadElements.push({
      text: `
Ты — AI-эксперт по системной архитектуре. На основе предоставленного технического задания, сгенерируй ОДНО изображение. 
Это изображение должно четко содержать ДВА РАЗДЕЛЬНЫХ, ПОДПИСАННЫХ блока-диаграммы:

1.  **Концептуальная архитектура:**
    *   Покажи основные высокоуровневые компоненты системы (например, Frontend, Backend, База данных, Внешние сервисы).
    *   Проиллюстрируй их главные взаимодействия и связи с помощью стрелок.
    *   Эта диаграмма должна быть простой и понятной. Используй общепринятые блоки (прямоугольники) и стрелки.
    *   Подпиши каждый блок и, если возможно, тип взаимодействия на стрелках (например, "API вызов", "Поток данных"). Все подписи должны быть на РУССКОМ ЯЗЫКЕ.

2.  **Архитектура приложения (Прикладная архитектура):**
    *   Предоставь более детальный взгляд на структуру приложения, фокусируясь на ключевых модулях или сервисах внутри Backend или Frontend.
    *   Покажи ключевые модули (например, Модуль аутентификации, Модуль управления пользователями, API Gateway, Сервис обработки заказов), слои (например, Presentation Layer, Business Logic Layer, Data Access Layer), и, если упомянуто в ТЗ, специфичные технологии или фреймворки для этих компонентов.
    *   Проиллюстрируй потоки данных и зависимости между этими компонентами с помощью стрелок.
    *   Используй стандартные архитектурные обозначения. Все подписи должны быть на РУССКОМ ЯЗЫКЕ.

Убедись, что обе диаграммы четко разделены (например, горизонтальной линией или достаточным пространством) и подписаны заголовками "Концептуальная Архитектура" и "Архитектура Приложения" (или "Прикладная Архитектура") НА РУССКОМ ЯЗЫКЕ внутри единого сгенерированного изображения. 

Стиль должен быть профессиональным, четким, легко читаемым и подходящим для технической документации. Используй светлый фон для диаграмм и контрастный текст.

Ключевое требование: ВСЕ текстовые элементы на изображении, включая названия компонентов, модулей, сервисов, слоев, описания взаимодействий на стрелках, и ОБЯЗАТЕЛЬНО заголовки самих диаграмм, должны быть на РУССКОМ ЯЗЫКЕ. Избегай использования английских терминов для меток, за исключением случаев, когда это название конкретной технологии, которое не имеет устоявшегося русского аналога и было явно упомянуто в исходном ТЗ (например, "PostgreSQL"). В общем случае, все метки — строго на русском.
      `
    });

    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 7000; // Image generation can take longer and be prone to timeouts
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        // Note: The 'output.schema' is more of a hint for complex object returns from text models.
        // For image generation, we primarily care about 'media.url'.
        const {media, text} = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp', // Specific model for image generation
          prompt: promptPayloadElements,
          config: {
            responseModalities: ['IMAGE', 'TEXT'], // Request IMAGE, TEXT is fallback/accompanying
            safetySettings: [ // Default or slightly relaxed safety settings
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
          },
        });

        if (media && media.url) {
          // Validate if the URL is a data URI, otherwise it might be an unusable GCS link for direct display
          if (!media.url.startsWith('data:image/')) {
             console.warn(`Attempt ${attempt + 1}: AI returned an image URL that is not a data URI: ${media.url}. Text: ${text}`);
             // This might happen if the model returns a GCS URI which isn't directly usable by client.
             // For this app, we expect a data URI.
             if (attempt === MAX_RETRIES - 1) {
                throw new Error(`AI не смог сгенерировать изображение в ожидаемом формате (data URI) после ${MAX_RETRIES} попыток.`);
             }
             // Retry might help if it's a transient issue with URI format.
             const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
             await new Promise(resolve => setTimeout(resolve, delay));
             attempt++;
             continue;
          }
          return { imageUrl: media.url };
        }
        
        console.warn(`Attempt ${attempt + 1}: AI did not return an image. Text response: ${text}`);
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`AI не смог сгенерировать изображение после ${MAX_RETRIES} попыток. Последний текстовый ответ: ${text}`);
        }

      } catch (e: any) {
        const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e);
        const isRetryableError = 
          errorMessage.includes('503') || // Service Unavailable
          errorMessage.includes('overloaded') || 
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('rate limit') || 
          errorMessage.includes('resource has been exhausted') || // Common for image models
          errorMessage.includes('deadline exceeded') || // Timeout
          errorMessage.includes('internal error') || // General Google error
          errorMessage.includes('try again later') ||
          errorMessage.includes('429'); // HTTP 429 Too Many Requests
        
        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            throw new Error('Сервис генерации изображений временно перегружен или достигнут лимит запросов. Пожалуйста, попробуйте позже.');
          }
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`Retryable error encountered. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-retryable error
          console.error("Non-retryable error in generateArchitecturalSketchesFlow:", e);
          throw e; 
        }
      }
      attempt++;
    }
    // Fallback, should ideally not be reached.
    throw new Error('Не удалось получить изображение от AI после всех попыток.');
  }
);

