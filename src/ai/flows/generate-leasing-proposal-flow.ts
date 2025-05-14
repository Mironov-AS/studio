
'use server';
/**
 * @fileOverview Generates leasing proposals for corporate clients.
 *
 * - generateLeasingProposal - A function that handles leasing proposal generation.
 * - GenerateLeasingProposalInput - The input type for the function.
 * - GenerateLeasingProposalOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssetTypeSchema = z.enum([
  "Недвижимость коммерческая", 
  "Недвижимость жилая (для сотрудников)", 
  "Оборудование производственное", 
  "Оборудование офисное", 
  "Транспорт"
]);

const GenerateLeasingProposalInputSchema = z.object({
  companyInfo: z.object({
    name: z.string().min(2, "Название компании обязательно.").describe("Название фирмы."),
    inn: z.string().optional().describe("ИНН компании (опционально)."),
    activitySphere: z.string().min(3, "Сфера деятельности обязательна.").describe("Сфера деятельности компании."),
  }).describe("Информация о компании-клиенте."),
  assetRequest: z.object({
    assetType: AssetTypeSchema.describe("Тип запрашиваемого имущества."),
    assetDetails: z.string().min(10, "Описание имущества обязательно (мин. 10 симв.).").describe("Детальное описание запрашиваемого имущества (местонахождение, площадь, целевое назначение для недвижимости; тип, модель, характеристики для оборудования)."),
    estimatedCost: z.number().positive("Стоимость должна быть положительным числом.").describe("Предполагаемая стоимость объекта лизинга в рублях."),
  }).describe("Информация о запрашиваемом имуществе."),
  leaseParameters: z.object({
    leaseTermMonths: z.number().int().min(6, "Мин. срок лизинга - 6 мес.").max(120, "Макс. срок лизинга - 120 мес.").describe("Предполагаемый срок лизинга в месяцах."),
    downPaymentPercentage: z.number().min(0, "Первоначальный взнос не может быть отрицательным.").max(90, "Макс. первоначальный взнос - 90%.").describe("Размер первоначального взноса в процентах от стоимости имущества (0-90)."),
  }).describe("Параметры лизинга."),
  clientPriorities: z.string().optional().describe("Приоритеты клиента (например, минимальный ежемесячный платеж, скорость оформления, гибкость условий выкупа, конкретные модели оборудования и т.д.)."),
});
export type GenerateLeasingProposalInput = z.infer<typeof GenerateLeasingProposalInputSchema>;

const SuggestedOptionSchema = z.object({
    optionTitle: z.string().describe("Заголовок варианта предложения (например, 'Вариант 1: Лизинг офисного помещения класса А в центре')."),
    assetDescription: z.string().describe("Детальное описание предлагаемого объекта или типа объекта, его ключевые характеристики и преимущества."),
    rationale: z.string().describe("Обоснование, почему этот вариант подходит под запрос клиента и его приоритеты."),
    preliminaryLeaseTerms: z.object({
        estimatedMonthlyPayment: z.string().describe("Примерный ежемесячный платеж или диапазон (например, '150 000 - 180 000 руб.')."),
        totalLeaseCost: z.string().describe("Примерная общая сумма выплат по лизингу за весь срок (например, '5 400 000 - 6 480 000 руб. за 36 мес.')."),
        effectiveRateApproximation: z.string().describe("Примерная эффективная процентная ставка или диапазон (например, 'Ставка удорожания от 7% годовых' или 'Эффективная ставка 12-15% годовых')."),
        mainConditions: z.string().describe("Ключевые условия лизинга (например, 'Возможность досрочного выкупа через 12 месяцев', 'Требуется страхование КАСКО за счет лизингополучателя', 'Штраф за просрочку платежа 0.1% в день')."),
    }).describe("Предварительные условия лизинга для данного варианта."),
});

const GenerateLeasingProposalOutputSchema = z.object({
  suggestedOptions: z.array(SuggestedOptionSchema).min(1).max(3).describe("Массив из 1-3 предложенных вариантов лизинга."),
  generalRecommendations: z.string().describe("Общие рекомендации по лизинговой сделке для клиента, на что обратить внимание при выборе, какие документы подготовить."),
  taxConsiderations: z.string().describe("Краткий обзор основных налоговых преимуществ и аспектов лизинга для юридических лиц в РФ (например, учет лизинговых платежей в расходах, возмещение НДС)."),
  nextStepsAdvised: z.string().describe("Рекомендуемые следующие шаги для клиента для оформления лизинга через Банк Дом.РФ (например, 'Подготовить пакет документов', 'Связаться с менеджером Банка Дом.РФ')."),
});
export type GenerateLeasingProposalOutput = z.infer<typeof GenerateLeasingProposalOutputSchema>;

export async function generateLeasingProposal(input: GenerateLeasingProposalInput): Promise<GenerateLeasingProposalOutput> {
  return generateLeasingProposalFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLeasingProposalPrompt',
  input: {schema: GenerateLeasingProposalInputSchema},
  output: {schema: GenerateLeasingProposalOutputSchema},
  prompt: `Вы — AI-эксперт по лизингу в Банке Дом.РФ. Ваша задача — подготовить коммерческое предложение по лизингу для корпоративного клиента на основе предоставленной информации. Клиент – юридическое лицо.

**Информация о клиенте и запросе:**
-   **Компания:**
    -   Название: {{{companyInfo.name}}}
    -   ИНН: {{#if companyInfo.inn}}{{{companyInfo.inn}}}{{else}}Не указан{{/if}}
    -   Сфера деятельности: {{{companyInfo.activitySphere}}}
-   **Запрос на лизинг:**
    -   Тип имущества: {{{assetRequest.assetType}}}
    -   Детали имущества: {{{assetRequest.assetDetails}}}
    -   Предполагаемая стоимость: {{{assetRequest.estimatedCost}}} руб.
-   **Параметры лизинга:**
    -   Срок лизинга: {{{leaseParameters.leaseTermMonths}}} мес.
    -   Первоначальный взнос: {{{leaseParameters.downPaymentPercentage}}}%
-   **Приоритеты клиента:** {{#if clientPriorities}}{{{clientPriorities}}}{{else}}Не указаны, исходить из стандартных предпочтений для корпоративных клиентов (оптимальное соотношение платежа и условий).{{/if}}

**Задача:**
Подготовьте 1-3 варианта лизинговых предложений. Для каждого варианта (suggestedOptions) укажите:
1.  **optionTitle**: Заголовок варианта (например, "Вариант 1: Лизинг [Тип Имущества] с минимальным авансом").
2.  **assetDescription**: Подробное описание предлагаемого имущества или его типа, его ключевые характеристики и преимущества для бизнеса клиента. Если в запросе дана конкретная модель/объект, отталкивайтесь от нее. Если нет – предложите подходящий тип/категорию.
3.  **rationale**: Обоснование, почему этот вариант подходит под запрос и приоритеты клиента.
4.  **preliminaryLeaseTerms**: Предварительные условия лизинга:
    *   **estimatedMonthlyPayment**: Примерный ежемесячный платеж (диапазон).
    *   **totalLeaseCost**: Примерная общая сумма выплат по лизингу за весь срок (диапазон).
    *   **effectiveRateApproximation**: Примерная эффективная процентная ставка или ставка удорожания (диапазон или формулировка "от X%").
    *   **mainConditions**: Ключевые условия (возможность выкупа, страхование, штрафы и т.д.).

Также предоставьте:
-   **generalRecommendations**: Общие рекомендации по сделке: на что обратить внимание, какие документы обычно требуются от юр. лица для оформления лизинга в Банке Дом.РФ.
-   **taxConsiderations**: Кратко об основных налоговых аспектах лизинга для юр. лиц в РФ (учет платежей в расходах, НДС).
-   **nextStepsAdvised**: Рекомендуемые следующие шаги для клиента (например, "Для получения точного расчета и начала оформления, пожалуйста, предоставьте следующие документы...", "Свяжитесь с вашим персональным менеджером в Банке Дом.РФ.").

Используйте свои знания о рынке лизинга, типичных ставках и условиях Банка Дом.РФ для корпоративных клиентов. Предложения должны быть реалистичными и привлекательными. Вся информация должна быть на русском языке.
`,
});

const generateLeasingProposalFlow = ai.defineFlow(
  {
    name: 'generateLeasingProposalFlow',
    inputSchema: GenerateLeasingProposalInputSchema,
    outputSchema: GenerateLeasingProposalOutputSchema,
  },
  async (input) => {
    // Input validation can be done here if needed, beyond Zod schema
    if (input.leaseParameters.downPaymentPercentage < 0 || input.leaseParameters.downPaymentPercentage > 90) {
        throw new Error("Процент первоначального взноса должен быть от 0 до 90.");
    }
    if (input.leaseParameters.leaseTermMonths < 6 || input.leaseParameters.leaseTermMonths > 120) {
        throw new Error("Срок лизинга должен быть от 6 до 120 месяцев.");
    }


    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI не смог сгенерировать предложение по лизингу.');
    }
    
    // Post-processing or validation of AI output if necessary
    if (output.suggestedOptions.length === 0) {
        // Fallback or refined error, though schema requires min 1.
        throw new Error('AI не предложил ни одного варианта лизинга. Попробуйте уточнить запрос.');
    }

    return output;
  }
);

