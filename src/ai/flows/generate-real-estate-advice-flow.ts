
'use server';
/**
 * @fileOverview Generates real estate investment advice based on user preferences.
 *
 * - generateRealEstateAdvice - A function that handles the advice generation.
 * - GenerateRealEstateAdviceInput - The input type for the function.
 * - GenerateRealEstateAdviceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRealEstateAdviceInputSchema = z.object({
  preferredRegion: z.string().describe('Предпочтительный регион или город для инвестиций (например, "Сочи", "Москва", "Ленинградская область").'),
  investmentHorizon: z.enum(['Краткосрочный (до 1 года)', 'Среднесрочный (1-5 лет)', 'Долгосрочный (более 5 лет)']).describe('Желаемый срок вложений.'),
  riskLevel: z.enum(['Низкий', 'Средний', 'Высокий']).describe('Уровень допустимого риска.'),
  propertyType: z.enum(['Квартиры', 'Коммерческая недвижимость', 'Земельные участки', 'Любой']).describe('Тип недвижимости для рассмотрения.'),
  budget: z.enum(['до 5 млн руб', '5-15 млн руб', '15-30 млн руб', 'свыше 30 млн руб']).describe('Примерный бюджет инвестиций.'),
  investmentGoals: z.array(z.string()).min(1).describe('Основные инвестиционные цели (например, ["Рост капитала", "Арендный доход"]).'),
});
export type GenerateRealEstateAdviceInput = z.infer<typeof GenerateRealEstateAdviceInputSchema>;

const SuggestedPropertySchema = z.object({
  type: z.string().describe('Тип предлагаемого объекта (например, "Квартира в новостройке", "Коммерческое помещение", "Земельный участок").'),
  locationHint: z.string().describe('Общее описание местоположения или его преимуществ (например, "Перспективный район с развивающейся инфраструктурой", "Рядом с новым транспортным узлом", "Вблизи курортной зоны").'),
  rationale: z.string().describe('Обоснование выбора данного типа объекта и локации, включая ожидаемую доходность и ключевые риски.'),
  potentialGrowth: z.string().describe('Оценка потенциала роста стоимости объекта (например, "Высокий", "Средний", "Умеренный").'),
});

const GenerateRealEstateAdviceOutputSchema = z.object({
  investmentPlanSummary: z.string().describe('Общее резюме предложенного инвестиционного плана на русском языке.'),
  suggestedProperties: z.array(SuggestedPropertySchema).describe('Массив из 2-3 предложенных объектов недвижимости.'),
  marketOutlook: z.string().describe('Краткий обзор текущих тенденций на рынке недвижимости для указанного региона и типа объектов на русском языке.'),
  nextSteps: z.string().describe('Рекомендации по дальнейшим действиям для инвестора на русском языке (например, "Провести детальный анализ предложенных объектов", "Проконсультироваться с юристом", "Рассмотреть варианты ипотечного кредитования в Банке Дом.РФ").'),
});
export type GenerateRealEstateAdviceOutput = z.infer<typeof GenerateRealEstateAdviceOutputSchema>;

export async function generateRealEstateAdvice(input: GenerateRealEstateAdviceInput): Promise<GenerateRealEstateAdviceOutput> {
  return generateRealEstateAdviceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRealEstateAdvicePrompt',
  input: {schema: GenerateRealEstateAdviceInputSchema},
  output: {schema: GenerateRealEstateAdviceOutputSchema},
  prompt: `Вы — передовой AI-робоэдвайзер по инвестициям в недвижимость от Банка Дом.РФ. Ваша задача — помочь клиентам сформировать оптимальный инвестиционный план.

Вы обладаете доступом и проанализировали обширные данные, включая:
- Исторические цены на жилье и коммерческую недвижимость.
- Тенденции развития рынка недвижимости в различных регионах России.
- Экономические показатели регионов (уровень доходов населения, занятость, инвестиционная привлекательность).
- Планы инфраструктурных изменений (строительство дорог, метро, социальных объектов).
- Демографические характеристики и перспективы развития районов.

На основе этих данных и предпочтений клиента, пожалуйста, сформируйте персонализированный инвестиционный план.

**Предпочтения клиента:**
- Предпочтительный регион/город: {{{preferredRegion}}}
- Желаемый срок вложений: {{{investmentHorizon}}}
- Уровень допустимого риска: {{{riskLevel}}}
- Тип недвижимости: {{{propertyType}}}
- Бюджет: {{{budget}}}
- Инвестиционные цели: {{#each investmentGoals}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

**Ваш ответ должен включать:**
1.  **investmentPlanSummary**: Краткое общее резюме предложенного инвестиционного плана. Опишите стратегию.
2.  **suggestedProperties**: Массив из 2-3 конкретных типов объектов недвижимости с указанием:
    *   **type**: Тип объекта (например, "Квартира в новостройке в районе X", "Коммерческое помещение под офис на улице Y").
    *   **locationHint**: Краткое описание преимуществ локации (например, "Район с высоким спросом на аренду", "Рядом с крупным бизнес-центром").
    *   **rationale**: Обоснование, почему этот объект подходит клиенту, его потенциальная доходность и ключевые риски.
    *   **potentialGrowth**: Оценка потенциала роста стоимости (например, "Высокий, ожидаемый рост 15-20% в течение 3 лет").
3.  **marketOutlook**: Краткий обзор текущих тенденций на рынке недвижимости для указанного региона и типа объектов. Укажите, что влияет на рынок.
4.  **nextSteps**: Конкретные рекомендации по дальнейшим действиям для инвестора (например, "Рекомендуем провести детальный осмотр объектов", "Обратитесь в Банк Дом.РФ для консультации по ипотеке").

Убедитесь, что все рекомендации реалистичны и соответствуют заявленным предпочтениям клиента. Ответ должен быть на русском языке и структурирован согласно схеме вывода.
Помните, что ваша цель — предоставить клиенту Банка Дом.РФ качественный и полезный инвестиционный совет, повышая его лояльность и помогая достичь финансовых целей.
`,
});

const generateRealEstateAdviceFlow = ai.defineFlow(
  {
    name: 'generateRealEstateAdviceFlow',
    inputSchema: GenerateRealEstateAdviceInputSchema,
    outputSchema: GenerateRealEstateAdviceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI не смог сгенерировать инвестиционный план.');
    }
    return output;
  }
);
