
'use server';
/**
 * @fileOverview Analyzes a simulated news feed for items relevant to "Банк ДОМ.РФ",
 * summarises them, determines sentiment, and explains negative sentiment.
 *
 * - analyzeNewsFeed - Function to get and process the news feed.
 * - AnalyzeNewsFeedInput - Input type (currently empty as news are simulated).
 * - AnalyzeNewsFeedOutput - Output type, containing processed news items.
 * - ProcessedNewsItem - Type for a single processed news item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// --- Schemas ---

const RawNewsArticleSchema = z.object({
  id: z.string(),
  title: z.string().describe("Original title of the news article."),
  link: z.string().url().describe("Link to the original news article."),
  source: z.string().describe("Source of the news (e.g., 'Ведомости', 'РБК')."),
  publishDate: z.string().describe("Publication date in YYYY-MM-DD format."),
  fullText: z.string().describe("Full text or a significant snippet of the news article for analysis."),
});
type RawNewsArticle = z.infer<typeof RawNewsArticleSchema>;

// ProcessedNewsItemSchema is used internally and its type ProcessedNewsItem is exported.
const ProcessedNewsItemSchema = z.object({
  id: z.string(),
  title: z.string().describe("Заголовок новости."),
  summary: z.string().describe("Краткое содержание новости (2-3 предложения) на русском языке."),
  source: z.string().describe("Источник новости (например, 'Ведомости', 'РБК')."),
  publishDate: z.string().describe("Дата публикации новости (в формате ГГГГ-ММ-ДД)."),
  link: z.string().url().optional().describe("Ссылка на оригинальную новость."),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("Окраска новости: 'positive', 'negative', 'neutral'."),
  negativityReason: z.string().optional().describe("Если новость негативная, краткое пояснение причин негатива (1-2 предложения) на русском языке."),
  isRelevantToBankDomRf: z.boolean().describe("True если новость касается Банка ДОМ.РФ, иначе false."),
});
export type ProcessedNewsItem = z.infer<typeof ProcessedNewsItemSchema>;

// AnalyzeNewsFeedInputSchema is used internally for the flow. Its type is exported.
const AnalyzeNewsFeedInputSchema = z.object({
  keywords: z.array(z.string()).optional().default(['Банк ДОМ.РФ', 'ДОМ.РФ']).describe("Ключевые слова для поиска новостей."),
  maxItems: z.number().optional().default(10).describe("Максимальное количество новостей для анализа."),
});
export type AnalyzeNewsFeedInput = z.infer<typeof AnalyzeNewsFeedInputSchema>;

// AnalyzeNewsFeedOutputSchema is used internally for the flow. Its type is exported.
const AnalyzeNewsFeedOutputSchema = z.object({
  processedNews: z.array(ProcessedNewsItemSchema).describe("Список обработанных новостей, релевантных ключевым словам (в первую очередь Банку ДОМ.РФ).")
});
export type AnalyzeNewsFeedOutput = z.infer<typeof AnalyzeNewsFeedOutputSchema>;


// --- Simulated News Fetching Tool ---

// Helper to get a somewhat realistic past date string
const getRandomPastDate = (index: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - (index % 20 + 1)); // News from the last 20 days
  date.setHours(date.getHours() - (index % 24));
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

const simulatedRawNewsData: RawNewsArticle[] = [
  {
    id: "news1",
    title: "Банк ДОМ.РФ успешно разместил новый выпуск ипотечных облигаций",
    link: "https://example.com/domrf-bonds-success",
    source: "РБК Инвестиции",
    publishDate: getRandomPastDate(0),
    fullText: "Банк ДОМ.РФ объявил об успешном размещении нового выпуска ипотечных ценных бумаг (ИЦБ) с поручительством ДОМ.РФ. Объем выпуска составил 50 млрд рублей. Спрос со стороны инвесторов превысил предложение в несколько раз, что свидетельствует о высоком доверии к банку и его финансовым инструментам. Средства от размещения будут направлены на дальнейшее развитие ипотечного кредитования.",
  },
  {
    id: "news2",
    title: "Эксперты отмечают рост ставок по вкладам в большинстве российских банков",
    link: "https://example.com/deposit-rates-rise",
    source: "Коммерсантъ",
    publishDate: getRandomPastDate(1),
    fullText: "Аналитики финансового рынка зафиксировали повышение процентных ставок по банковским вкладам в России. Это связано с общей экономической ситуацией и политикой Центрального Банка. Банк ДОМ.РФ также скорректировал свои предложения по депозитам для физических лиц в соответствии с рыночными трендами.",
  },
  {
    id: "news3",
    title: "Клиенты Банка ДОМ.РФ жалуются на сбои в работе мобильного приложения",
    link: "https://example.com/domrf-app-issues",
    source: "Банки.ру",
    publishDate: getRandomPastDate(2),
    fullText: "В последние несколько дней пользователи мобильного приложения Банка ДОМ.РФ сообщают о периодических сбоях и трудностях с проведением операций. В социальных сетях и на форумах появляются многочисленные жалобы на невозможность войти в систему или длительное ожидание ответа от службы поддержки. Представители банка пока не дали официальных комментариев.",
  },
  {
    id: "news4",
    title: "ДОМ.РФ и правительство обсуждают новые меры поддержки строительной отрасли",
    link: "https://example.com/construction-support-measures",
    source: "Интерфакс",
    publishDate: getRandomPastDate(3),
    fullText: "Институт развития ДОМ.РФ активно участвует в разработке новых государственных программ, направленных на поддержку строительного сектора и повышение доступности жилья. Обсуждаются вопросы субсидирования ипотечных ставок и упрощения процедур для застройщиков.",
  },
  {
    id: "news5",
    title: "Банк ДОМ.РФ расширяет программу льготной ипотеки для IT-специалистов",
    link: "https://example.com/domrf-it-mortgage",
    source: "Ведомости",
    publishDate: getRandomPastDate(4),
    fullText: "Банк ДОМ.РФ объявил о расширении условий программы льготной ипотеки для сотрудников IT-компаний. Снижена процентная ставка и увеличен максимальный размер кредита. Это решение направлено на поддержку одной из ключевых отраслей экономики и удержание квалифицированных кадров в стране.",
  },
  {
    id: "news6",
    title: "Скандал вокруг строительного проекта N: Банк ДОМ.РФ среди кредиторов",
    link: "https://example.com/construction-scandal-project-n",
    source: "Forbes Russia",
    publishDate: getRandomPastDate(5),
    fullText: "Разгорается скандал вокруг крупного строительного проекта 'Проект N', который заморожен из-за финансовых проблем застройщика. Среди основных кредиторов проекта фигурирует Банк ДОМ.РФ, предоставивший значительные средства. Дольщики опасаются потери своих вложений, а эксперты оценивают возможные репутационные и финансовые риски для банка.",
  },
  {
    id: "news7",
    title: "Центробанк повысил ключевую ставку: как это повлияет на ипотеку от Банка ДОМ.РФ?",
    link: "https://example.com/cb-rate-hike-impact",
    source: "РБК",
    publishDate: getRandomPastDate(6),
    fullText: "Центральный Банк России принял решение о повышении ключевой ставки. Это событие неизбежно отразится на стоимости кредитования, включая ипотечные программы. Банк ДОМ.РФ, как один из ключевых игроков на рынке ипотеки, уже анализирует ситуацию и готовит возможные изменения в своих продуктах.",
  },
  {
    id: "news8",
    title: "Банк ДОМ.РФ получил награду за лучший цифровой сервис для застройщиков",
    link: "https://example.com/domrf-digital-award",
    source: "FutureBanking",
    publishDate: getRandomPastDate(7),
    fullText: "На ежегодной премии 'Digital Finance Awards' Банк ДОМ.РФ был отмечен наградой в номинации 'Лучший цифровой сервис для застройщиков'. Экспертное жюри высоко оценило инновационную платформу банка, упрощающую взаимодействие застройщиков с финансовой организацией и процесс проектного финансирования.",
  }
];


const fetchBankNewsTool = ai.defineTool(
  {
    name: 'fetchBankNewsTool',
    description: 'Получает последние новости, потенциально связанные с Банком ДОМ.РФ из симулированных источников.',
    inputSchema: z.object({
      keywords: z.array(z.string()).optional().default(['Банк ДОМ.РФ', 'ДОМ.РФ']),
      count: z.number().optional().default(10).describe("Количество новостей для получения."),
    }),
    outputSchema: z.array(RawNewsArticleSchema),
  },
  async (input) => {
    console.log(`[Tool:fetchBankNewsTool] Simulating news fetch for keywords: ${input.keywords?.join(', ')}, count: ${input.count}`);
    // Simulate filtering by keywords (rudimentary for this example)
    const lowerCaseKeywords = input.keywords?.map(k => k.toLowerCase());
    
    const filteredNews = simulatedRawNewsData.filter(news => {
        const titleLower = news.title.toLowerCase();
        const textLower = news.fullText.toLowerCase();
        return lowerCaseKeywords?.some(kw => titleLower.includes(kw) || textLower.includes(kw));
    }).slice(0, input.count);

    // If not enough news specifically about the bank, add some general financial news to make up the count
    const generalNewsNeeded = (input.count ?? 10) - filteredNews.length; // Use default if input.count is undefined
    if (generalNewsNeeded > 0) {
        const generalNews = simulatedRawNewsData.filter(news => 
            !lowerCaseKeywords?.some(kw => news.title.toLowerCase().includes(kw) || news.fullText.toLowerCase().includes(kw))
        ).slice(0, generalNewsNeeded);
        filteredNews.push(...generalNews);
    }
    
    return filteredNews.slice(0, input.count); // Ensure we don't exceed count
  }
);

// --- Main Flow ---

export async function analyzeNewsFeed(input: AnalyzeNewsFeedInput): Promise<AnalyzeNewsFeedOutput> {
  return analyzeNewsFeedFlow(input);
}

const newsProcessingPrompt = ai.definePrompt({
  name: 'newsProcessingPrompt',
  input: { schema: RawNewsArticleSchema }, // Process one article at a time
  output: { schema: ProcessedNewsItemSchema }, // Use the non-exported schema for internal AI guidance
  prompt: `Проанализируй следующую новость. Определи, касается ли она непосредственно Банка ДОМ.РФ или аффилированных с ним структур (например, самого ДОМ.РФ).

Новость для анализа:
Заголовок: {{{title}}}
Источник: {{{source}}}
Дата публикации: {{{publishDate}}}
Ссылка: {{{link}}}
Текст:
{{{fullText}}}

Задачи:
1.  isRelevantToBankDomRf: Определи, релевантна ли эта новость для Банка ДОМ.РФ. Если да, установи true, иначе false. Учитывай упоминания "Банк ДОМ.РФ", "ДОМ.РФ" и их деятельности.
2.  summary: Сформируй очень краткое содержание новости (1-2 предложения) на русском языке. Если новость нерелевантна, в содержании укажи "Новость не относится к Банку ДОМ.РФ".
3.  sentiment: Определи общую тональность новости по отношению к Банку ДОМ.РФ (если она релевантна) или общую тональность новости (если нерелевантна). Возможные значения: "positive", "negative", "neutral".
4.  negativityReason: Если тональность "negative" И новость релевантна Банку ДОМ.РФ, кратко (1 предложение) поясни, в чем заключается негатив. В остальных случаях оставь это поле пустым.
5.  Сохрани исходные id, title, source, publishDate, link.

Верни результат в JSON-формате, соответствующем ProcessedNewsItemSchema.
`,
});


const analyzeNewsFeedFlow = ai.defineFlow(
  {
    name: 'analyzeNewsFeedFlow',
    inputSchema: AnalyzeNewsFeedInputSchema, // Use the non-exported schema
    outputSchema: AnalyzeNewsFeedOutputSchema, // Use the non-exported schema
  },
  async (input) => {
    console.log('[analyzeNewsFeedFlow] Started with input:', input);
    
    const rawArticles = await fetchBankNewsTool({keywords: input.keywords, count: input.maxItems});

    if (!rawArticles || rawArticles.length === 0) {
      console.log('[analyzeNewsFeedFlow] No raw articles fetched by the tool.');
      return { processedNews: [] };
    }
    console.log(`[analyzeNewsFeedFlow] Fetched ${rawArticles.length} raw articles by tool.`);

    const processingPromises = rawArticles.map(async (article) => {
      try {
        const { output } = await newsProcessingPrompt(article);
        if (!output) {
          console.warn(`[analyzeNewsFeedFlow] AI returned null output for article ID: ${article.id}. Title: ${article.title}`);
          // Fallback or skip this article
          return {
             id: article.id,
             title: article.title,
             summary: "Не удалось обработать новость.",
             source: article.source,
             publishDate: article.publishDate,
             link: article.link,
             sentiment: "neutral" as const,
             isRelevantToBankDomRf: false, // Assume not relevant if processing failed
          };
        }
        return output;
      } catch (error) {
        console.error(`[analyzeNewsFeedFlow] Error processing article ID ${article.id} (Title: ${article.title}):`, error);
        return { // Fallback structure on error
             id: article.id,
             title: article.title,
             summary: `Ошибка обработки: ${(error as Error).message}`,
             source: article.source,
             publishDate: article.publishDate,
             link: article.link,
             sentiment: "neutral" as const,
             isRelevantToBankDomRf: false,
          };
      }
    });

    const processedNewsItems = await Promise.all(processingPromises);
    
    // Filter out items that AI marked as not relevant AFTER processing, if desired.
    // For now, we return all processed items, and client can filter.
    const relevantNews = processedNewsItems.filter(news => news.isRelevantToBankDomRf);


    console.log(`[analyzeNewsFeedFlow] Finished. Processed ${processedNewsItems.length} articles, found ${relevantNews.length} relevant to Bank DOM.RF.`);
    return { processedNews: relevantNews }; // Return only relevant news
  }
);


    