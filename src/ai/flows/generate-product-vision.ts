'use server';

/**
 * @fileOverview Generates an initial product vision statement in Russian based on a user's idea.
 *
 * - generateProductVision - A function that generates the product vision.
 * - GenerateProductVisionInput - The input type for the generateProductVision function.
 * - GenerateProductVisionOutput - The return type for the generateProductVision function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductVisionInputSchema = z.object({
  idea: z.string().describe('The initial product idea.'),
});
export type GenerateProductVisionInput = z.infer<typeof GenerateProductVisionInputSchema>;

const GenerateProductVisionOutputSchema = z.object({
  visionStatement: z.string().describe('The generated product vision statement in Russian.'),
});
export type GenerateProductVisionOutput = z.infer<typeof GenerateProductVisionOutputSchema>;

export async function generateProductVision(input: GenerateProductVisionInput): Promise<GenerateProductVisionOutput> {
  return generateProductVisionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductVisionPrompt',
  input: {schema: GenerateProductVisionInputSchema},
  output: {schema: GenerateProductVisionOutputSchema},
  prompt: `Вы - опытный владелец продукта с техническим и бизнесс образованием, работающий много лет в крупных российских банках на стыке бизнеса и ИТ, специализирующийся на формировании видения продукта. Цель продуктов - закрыть потребности клиентов, сделать услуги банка лучшими на рынке.   На основе предоставленной идеи сгенерируйте убедительное видение продукта на русском языке. 

Идея: {{{idea}}}`,
});

const generateProductVisionFlow = ai.defineFlow(
  {
    name: 'generateProductVisionFlow',
    inputSchema: GenerateProductVisionInputSchema,
    outputSchema: GenerateProductVisionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
