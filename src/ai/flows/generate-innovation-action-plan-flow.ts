
'use server';
/**
 * @fileOverview Generates an action plan for an innovation idea using AI.
 *
 * - generateInnovationActionPlan - A function that handles the action plan generation.
 * - GenerateInnovationActionPlanInput - The input type for the function.
 * - GenerateInnovationActionPlanOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInnovationActionPlanInputSchema = z.object({
  ideaTitle: z.string().optional().describe("Название или краткий заголовок идеи."),
  ideaDescription: z.string().min(20, "Описание идеи должно содержать не менее 20 символов.").describe("Подробное описание инновационной идеи или предложения."),
  proposerDepartment: z.string().optional().describe("Отдел или подразделение сотрудника, предложившего идею (необязательно)."),
});
export type GenerateInnovationActionPlanInput = z.infer<typeof GenerateInnovationActionPlanInputSchema>;

const GenerateInnovationActionPlanOutputSchema = z.object({
  suggestedCategories: z.array(z.string()).describe("Предлагаемые категории или теги для идеи на русском языке (например, 'Улучшение ИТ-инфраструктуры', 'Маркетинг', 'Оптимизация процессов')."),
  potentialImpact: z.string().describe("Краткая оценка потенциального влияния или выгоды от реализации идеи на русском языке."),
  roadmapSteps: z.array(z.string()).describe("Список предлагаемых шагов (дорожная карта) для реализации идеи на русском языке."),
  resourceSuggestions: z.array(z.string()).describe("Предложения по необходимым ресурсам (например, 'Команда разработчиков', 'Бюджет на маркетинг', 'Экспертиза в области X') на русском языке."),
  estimatedTimeline: z.string().describe("Примерная оценка временных рамок для реализации идеи на русском языке (например, '1-3 месяца', 'До 6 месяцев')."),
  keyMetricsForSuccess: z.array(z.string()).describe("Ключевые метрики для оценки успеха реализации идеи на русском языке (например, 'Снижение затрат на X%', 'Увеличение вовлеченности пользователей на Y%')."),
  documentTemplateHints: z.array(z.string()).describe("Подсказки по необходимым шаблонам документов для инициации проекта на русском языке (например, 'Шаблон бюджета проекта', 'Техническое задание', 'План-график работ')."),
});
export type GenerateInnovationActionPlanOutput = z.infer<typeof GenerateInnovationActionPlanOutputSchema>;

export async function generateInnovationActionPlan(input: GenerateInnovationActionPlanInput): Promise<GenerateInnovationActionPlanOutput> {
  return generateInnovationActionPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInnovationActionPlanPrompt',
  input: {schema: GenerateInnovationActionPlanInputSchema},
  output: {schema: GenerateInnovationActionPlanOutputSchema},
  prompt: `Вы — AI-ассистент в корпоративном центре инноваций (InnovHub). Ваша задача — проанализировать предложенную сотрудником идею и помочь сформировать первоначальный план действий. Ответ должен быть на русском языке.

**Информация об идее:**
{{#if ideaTitle}}
-   Название идеи: {{{ideaTitle}}}
{{/if}}
-   Описание идеи: {{{ideaDescription}}}
{{#if proposerDepartment}}
-   Отдел предложившего: {{{proposerDepartment}}}
{{/if}}

**Проанализируйте идею и предоставьте следующую информацию:**

1.  **suggestedCategories**: Предложите 2-3 категории или тега для этой идеи (например, "Оптимизация клиентского сервиса", "Внедрение ИИ в HR", "Снижение операционных расходов").
2.  **potentialImpact**: Кратко опишите потенциальное положительное влияние или выгоду от реализации этой идеи для компании.
3.  **roadmapSteps**: Сформируйте дорожную карту из 3-5 ключевых шагов для реализации идеи. Каждый шаг должен быть четким и понятным.
4.  **resourceSuggestions**: Укажите 2-3 типа основных ресурсов, которые могут потребоваться для реализации (например, "Команда разработчиков Python", "Бюджет на пилотный проект", "Экспертиза в области машинного обучения").
5.  **estimatedTimeline**: Дайте примерную оценку общих временных рамок для реализации идеи (например, "Краткосрочный (1-3 месяца)", "Среднесрочный (3-6 месяцев)", "Долгосрочный (6-12 месяцев)").
6.  **keyMetricsForSuccess**: Предложите 2-3 ключевые метрики, по которым можно будет оценить успех внедрения идеи (например, "Снижение времени обработки заявок на 15%", "Повышение удовлетворенности клиентов на 10 пунктов").
7.  **documentTemplateHints**: Укажите, какие типовые документы могут потребоваться для старта проекта по этой идее (например, "Технико-экономическое обоснование", "Презентация для руководства", "План тестирования").

Убедитесь, что ваш ответ структурирован согласно указанным полям вывода. Вся информация должна быть на русском языке.
Помните, что это первоначальный анализ, который поможет сотрудникам и руководству принять решение о дальнейшей проработке идеи.
`,
});

const generateInnovationActionPlanFlow = ai.defineFlow(
  {
    name: 'generateInnovationActionPlanFlow',
    inputSchema: GenerateInnovationActionPlanInputSchema,
    outputSchema: GenerateInnovationActionPlanOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI не смог сгенерировать план действий для инновационной идеи.');
    }
    return output;
  }
);
