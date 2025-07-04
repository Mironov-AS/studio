
'use server';
/**
 * @fileOverview Generates corporate real estate investment advice based on company profile and preferences.
 *
 * - generateCorporateRealEstateAdvice - A function that handles the advice generation.
 * - GenerateCorporateRealEstateAdviceInput - The input type for the function.
 * - GenerateCorporateRealEstateAdviceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CorporatePropertyTypeSchema = z.enum([
  "Офисные помещения",
  "Складские комплексы",
  "Торговые площади",
  "Производственные помещения",
  "Земельные участки (коммерческие)",
  "Многофункциональные комплексы",
  "Гостиничная недвижимость",
  "Другое",
]);

const CorporateInvestmentObjectiveSchema = z.enum([
  "Для собственных нужд (офис, производство, склад)",
  "Инвестиции для сдачи в аренду",
  "Инвестиции для перепродажи (рост капитала)",
  "Диверсификация активов",
  "Формирование залогового фонда",
  "Стратегическое развитие (выход на новые рынки)",
]);

const GenerateCorporateRealEstateAdviceInputSchema = z.object({
  companyName: z.string().describe("Наименование компании."),
  industry: z.string().describe("Отрасль деятельности компании."),
  companyProfile: z.string().describe("Краткое описание компании, ее текущего финансового положения, активов и обязательств."),
  expansionStrategy: z.string().optional().describe("Стратегия расширения и диверсификации бизнеса компании, если есть."),
  regionsOfInterest: z.string().describe("Предпочтительные регионы или города для инвестиций/размещения (например, 'Москва, Санкт-Петербург, промышленные зоны Урала')."),
  preferredPropertyTypes: z.array(CorporatePropertyTypeSchema).min(1).describe("Предпочтительные типы коммерческой недвижимости."),
  investmentObjectives: z.array(CorporateInvestmentObjectiveSchema).min(1).describe("Основные инвестиционные или бизнес-цели, связанные с недвижимостью."),
  budgetRange: z.enum(['до 50 млн руб', '50-200 млн руб', '200-500 млн руб', 'свыше 500 млн руб', 'Индивидуально']).describe("Примерный бюджет или диапазон инвестиций."),
  investmentHorizon: z.enum(['Краткосрочный (до 3 лет)', 'Среднесрочный (3-7 лет)', 'Долгосрочный (более 7 лет)']).describe("Желаемый срок инвестиций или использования объекта."),
  riskAppetite: z.enum(['Консервативный', 'Умеренный', 'Высокий']).describe("Уровень допустимого риска для инвестиций."),
  additionalRequirements: z.string().optional().describe("Дополнительные требования или комментарии (например, 'необходимость ж/д ветки', 'высокие потолки', 'близость к логистическим хабам').")
});
export type GenerateCorporateRealEstateAdviceInput = z.infer<typeof GenerateCorporateRealEstateAdviceInputSchema>;

const CorporateSuggestedPropertySchema = z.object({
  type: z.string().describe('Тип предлагаемого объекта (например, "Офисный центр класса B+", "Современный складской комплекс", "Торговое помещение в ТРЦ").'),
  locationCriteria: z.string().describe('Критерии или общее описание рекомендуемой локации (например, "Район с развитой деловой инфраструктурой", "Вблизи крупных транспортных магистралей", "Промышленный парк с готовыми коммуникациями").'),
  rationaleForBusiness: z.string().describe('Обоснование выбора данного типа объекта и локации с точки зрения потребностей и целей бизнеса компании.'),
  estimatedBudgetCategory: z.string().describe('Примерная категория бюджета для данного типа объекта (например, "100-250 млн руб.", "Свыше 1 млрд руб.").'),
  keyBenefits: z.string().describe('Ключевые преимущества данного варианта для компании (например, "Потенциал для роста стоимости", "Стабильный арендный доход", "Оптимизация логистики").'),
  potentialRisks: z.string().describe('Основные риски, связанные с данным типом инвестиций или объектом (например, "Риски вакантности", "Инфраструктурные ограничения", "Длительный срок окупаемости").')
});

const GenerateCorporateRealEstateAdviceOutputSchema = z.object({
  overallStrategyRecommendation: z.string().describe('Общая рекомендуемая стратегия инвестирования в недвижимость для компании на русском языке.'),
  suggestedProperties: z.array(CorporateSuggestedPropertySchema).min(1).max(3).describe('Массив из 1-3 предложенных типов объектов/локаций для рассмотрения.'),
  marketSegmentOutlook: z.string().describe('Краткий обзор перспектив и тенденций на релевантных сегментах рынка коммерческой недвижимости для указанного профиля компании.'),
  profitabilityConsiderations: z.string().describe('Ключевые аспекты для анализа доходности и экономической целесообразности инвестиций в предложенные типы объектов (ROI, NPV, факторы влияния).'),
  portfolioManagementNotes: z.string().optional().describe('Заметки по управлению портфелем недвижимости для корпоративного клиента, если применимо (диверсификация, оптимизация).'),
  financingAndCollateralRemarks: z.string().optional().describe('Рекомендации или соображения по финансированию приобретения или использованию недвижимости в качестве залога, если релевантно.'),
  recommendedNextSteps: z.string().describe('Рекомендации по дальнейшим действиям для компании (например, "Провести детальный due diligence объектов", "Запросить коммерческие предложения от застройщиков", "Проконсультироваться с юридическим отделом Банка Дом.РФ по структурированию сделки").'),
});
export type GenerateCorporateRealEstateAdviceOutput = z.infer<typeof GenerateCorporateRealEstateAdviceOutputSchema>;

export async function generateCorporateRealEstateAdvice(input: GenerateCorporateRealEstateAdviceInput): Promise<GenerateCorporateRealEstateAdviceOutput> {
  return generateCorporateRealEstateAdviceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCorporateRealEstateAdvicePrompt',
  input: {schema: GenerateCorporateRealEstateAdviceInputSchema},
  output: {schema: GenerateCorporateRealEstateAdviceOutputSchema},
  prompt: `Вы — ведущий AI-консультант по корпоративным инвестициям в недвижимость от Банка Дом.РФ. Ваша задача — помочь крупным корпоративным клиентам сформировать стратегический инвестиционный план и подобрать оптимальные объекты недвижимости, учитывая специфику их бизнеса.

Вы обладаете доступом и проанализировали обширные данные, включая:
- Рыночные ставки аренды и продажи коммерческой недвижимости различных классов и типов.
- Экономические прогнозы и отраслевые тенденции.
- Данные о развитии инфраструктуры в регионах России (транспортные узлы, промышленные парки, деловые кварталы).
- Инвестиционную привлекательность различных регионов и городов для корпоративного сектора.
- Требования к коммерческой недвижимости со стороны различных отраслей.
- Юридические и налоговые аспекты владения и управления коммерческой недвижимостью.

На основе этих данных и предоставленной информации о компании-клиенте, пожалуйста, сформируйте персонализированный инвестиционный совет.

**Информация о компании-клиенте:**
- Наименование компании: {{{companyName}}}
- Отрасль деятельности: {{{industry}}}
- Профиль компании (финансовое положение, активы, обязательства): {{{companyProfile}}}
- Стратегия расширения/диверсификации: {{#if expansionStrategy}}{{{expansionStrategy}}}{{else}}Не указана{{/if}}
- Регионы интереса: {{{regionsOfInterest}}}
- Предпочтительные типы недвижимости: {{#each preferredPropertyTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- Инвестиционные/бизнес-цели: {{#each investmentObjectives}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- Бюджет: {{{budgetRange}}}
- Срок инвестиций/использования: {{{investmentHorizon}}}
- Уровень допустимого риска: {{{riskAppetite}}}
{{#if additionalRequirements}}
- Дополнительные требования: {{{additionalRequirements}}}
{{/if}}

**Ваш ответ должен включать следующие разделы на русском языке:**

1.  **overallStrategyRecommendation**: Общая рекомендуемая стратегия инвестирования или использования недвижимости для компании. Учтите цели, отрасль и профиль компании.

2.  **suggestedProperties**: Массив из 1-3 предложенных типов объектов недвижимости и/или критериев локации, с указанием для каждого:
    *   **type**: Тип объекта (например, "Офисный центр класса А в новом деловом районе", "Складской комплекс с ж/д веткой в промышленной зоне N").
    *   **locationCriteria**: Описание рекомендуемых характеристик местоположения (например, "Близость к основным транспортным артериям", "Наличие подъездных путей для большегрузного транспорта", "Высокий пешеходный трафик для ритейла").
    *   **rationaleForBusiness**: Обоснование, почему этот тип объекта и локация подходят для бизнеса клиента, как это поможет достичь их целей (например, "Оптимизация логистических издержек", "Привлечение квалифицированных кадров", "Увеличение клиентского потока").
    *   **estimatedBudgetCategory**: Примерная категория бюджета для такого объекта (например, "200-300 млн руб.", "От 1 млрд руб.").
    *   **keyBenefits**: Ключевые выгоды (например, "Высокий потенциал роста стоимости в данной локации", "Возможность получения стабильного арендного дохода от якорных арендаторов", "Повышение операционной эффективности").
    *   **potentialRisks**: Основные риски (например, "Длительный срок поиска арендаторов", "Зависимость от развития инфраструктуры района", "Высокие эксплуатационные расходы").

3.  **marketSegmentOutlook**: Краткий обзор перспектив и тенденций на релевантных сегментах рынка коммерческой недвижимости, учитывая профиль компании. Что сейчас актуально, какие есть возможности и угрозы.

4.  **profitabilityConsiderations**: Ключевые аспекты для анализа доходности. Упомяните, какие показатели (например, ROI, NPV, срок окупаемости) компании следует рассчитать. Какие внешние факторы могут повлиять на доходность (например, инфляция, изменение ставок аренды, налоговое законодательство).

5.  **portfolioManagementNotes** (опционально, если применимо и есть информация для этого): Краткие заметки по управлению портфелем недвижимости, если у компании уже есть объекты или планируется формирование крупного портфеля (например, советы по диверсификации, редевелопменту, продаже неэффективных активов). Если не применимо, можно указать "Для формирования первоначального портфеля данный раздел менее релевантен на текущем этапе." или подобное.

6.  **financingAndCollateralRemarks** (опционально, если применимо): Соображения по возможным схемам финансирования приобретения (кредит, лизинг) или использованию недвижимости в качестве залога для получения финансирования на другие бизнес-цели. Упомяните возможность консультации в Банке Дом.РФ. Если информация острая или недостаточна, можно указать "Вопросы финансирования требуют индивидуальной проработки с Банком Дом.РФ."

7.  **recommendedNextSteps**: Конкретные рекомендации по дальнейшим действиям для компании (например, "Провести детальный маркетинговый анализ выбранных локаций", "Обратиться в Банк Дом.РФ для предварительной оценки возможности финансирования", "Разработать ТЗ для поиска или строительства объекта").

Убедитесь, что все рекомендации реалистичны, соответствуют профилю корпоративного клиента и его целям. Ответ должен быть структурирован согласно схеме вывода. Помните, что ваша цель — предоставить клиенту Банка Дом.РФ качественный и полезный инвестиционный совет, который поможет развитию его бизнеса.
`,
});

const generateCorporateRealEstateAdviceFlow = ai.defineFlow(
  {
    name: 'generateCorporateRealEstateAdviceFlow',
    inputSchema: GenerateCorporateRealEstateAdviceInputSchema,
    outputSchema: GenerateCorporateRealEstateAdviceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI не смог сгенерировать инвестиционный план для корпоративного клиента.');
    }
    return output;
  }
);
