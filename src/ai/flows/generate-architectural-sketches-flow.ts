
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
      promptPayloadElements.push({text: "Analyze the following technical specification (provided as a media file):"});
      promptPayloadElements.push({media: {url: input.techSpecDataUri, mimeType: mimeType }});

    } else if (supportedTextMimeTypes.includes(mimeType)) {
      const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8');
      promptPayloadElements.push({text: "Analyze the following technical specification (provided as text):"});
      promptPayloadElements.push({text: decodedText});
    } else {
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
          throw new Error(`DOCX/DOC file formats are not supported for direct analysis. Please convert the file to PDF or TXT and upload again.`);
      }
      throw new Error(`File type '${mimeType}' is not supported. Please upload a TXT, PDF, or image file (PNG, JPG, WebP).`);
    }
    
    promptPayloadElements.push({
      text: `
You are an AI expert in system architecture. Based on the provided technical specification, generate ONE image.
This image must clearly contain TWO SEPARATE, LABELED block diagrams:

1.  **Conceptual Architecture:**
    *   Show the main high-level components of the system (e.g., Frontend, Backend, Database, External Services).
    *   Illustrate their main interactions and connections using arrows.
    *   This diagram should be simple and clear. Use standard blocks (rectangles) and arrows.
    *   Label each block and, if possible, the type of interaction on the arrows (e.g., "API call", "Data flow"). All labels must be in ENGLISH.

2.  **Application Architecture:**
    *   Provide a more detailed view of the application structure, focusing on key modules or services within the Backend or Frontend.
    *   Show key modules (e.g., Authentication Module, User Management Module, API Gateway, Order Processing Service), layers (e.g., Presentation Layer, Business Logic Layer, Data Access Layer), and, if mentioned in the TS, specific technologies or frameworks for these components.
    *   Illustrate data flows and dependencies between these components using arrows.
    *   Use standard architectural notations. All labels must be in ENGLISH.

Ensure that both diagrams are clearly separated (e.g., by a horizontal line or sufficient space) and labeled with the headings "Conceptual Architecture" and "Application Architecture" in ENGLISH within the single generated image.

The style should be professional, clear, easy to read, and suitable for technical documentation. Use a light background for the diagrams and contrasting text.

Key requirement: ALL textual elements in the image, including names of components, modules, services, layers, descriptions of interactions on arrows, and MANDATORILY the headings of the diagrams themselves, must be in ENGLISH.
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
                throw new Error(`AI failed to generate an image in the expected format (data URI) after ${MAX_RETRIES} attempts.`);
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
          throw new Error(`AI failed to generate an image after ${MAX_RETRIES} attempts. Last text response: ${text}`);
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
            throw new Error('The image generation service is temporarily overloaded or the request limit has been reached. Please try again later.');
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
    throw new Error('Failed to get an image from AI after all attempts.');
  }
);

