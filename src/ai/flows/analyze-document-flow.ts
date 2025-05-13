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

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
  return analyzeDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {schema: AnalyzeDocumentInputSchema},
  output: {schema: AnalyzeDocumentOutputSchema},
  prompt: `Вы — AI-ассистент, специализирующийся на анализе документов. Ваша задача — проанализировать предоставленный документ, составить краткую сводку его содержания и определить тип документа.

Документ для анализа:
{{media url=documentDataUri}}
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
    inputSchema: AnalyzeDocumentInputSchema,
    outputSchema: AnalyzeDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI did not return an output.');
    }
    return output;
  }
);
