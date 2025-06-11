
'use server';
/**
 * @fileOverview Analyzes a news feed for items relevant to "Банк ДОМ.РФ",
 * summarises them, determines sentiment, and explains negative sentiment.
 *
 * - analyzeNewsFeed - Function to get and process the news feed.
 * - AnalyzeNewsFeedInput - Input type (currently empty as news are simulated).
 * - AnalyzeNewsFeedOutput - Output type, containing processed news items.
 * - ProcessedNewsItem - Type for a single processed news item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import Parser from 'rss-parser'; // Added for RSS parsing

// --- Schemas ---

const RawNewsArticleSchema = z.object({
  id: z.string(),
  title: z.string().describe("Original title of the news article."),
  link: z.string().url().optional().describe("Link to the original news article. Can be undefined if not available or invalid."),
  source: z.string().describe("Source of the news (e.g., 'Ведомости', 'РБК', 'Yandex News RSS')."),
  publishDate: z.string().describe("Publication date in YYYY-MM-DD format."),
  fullText: z.string().describe("Full text or a significant snippet/description of the news article for analysis."),
});
type RawNewsArticle = z.infer<typeof RawNewsArticleSchema>;

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

const AnalyzeNewsFeedInputSchema = z.object({
  keywords: z.array(z.string()).optional().default(['Банк ДОМ.РФ', 'ДОМ.РФ']).describe("Ключевые слова для поиска новостей."),
  maxItems: z.number().optional().default(10).describe("Максимальное количество новостей для анализа."),
});
export type AnalyzeNewsFeedInput = z.infer<typeof AnalyzeNewsFeedInputSchema>;

const AnalyzeNewsFeedOutputSchema = z.object({
  processedNews: z.array(ProcessedNewsItemSchema).describe("Список обработанных новостей, релевантных ключевым словам (в первую очередь Банку ДОМ.РФ).")
});
export type AnalyzeNewsFeedOutput = z.infer<typeof AnalyzeNewsFeedOutputSchema>;


// --- Simulated News Fetching Tool (with placeholders for real API) ---

const getRandomPastDate = (index: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - (index % 20 + 1));
  date.setHours(date.getHours() - (index % 24));
  return date.toISOString().split('T')[0];
}

const simulatedRawNewsData: RawNewsArticle[] = [
  {
    id: "sim_news1",
    title: "Банк ДОМ.РФ успешно разместил новый выпуск ипотечных облигаций (СИМУЛЯЦИЯ)",
    link: "https://example.com/domrf-bonds-success",
    source: "РБК Инвестиции (Симуляция)",
    publishDate: getRandomPastDate(0),
    fullText: "Банк ДОМ.РФ объявил об успешном размещении нового выпуска ипотечных ценных бумаг (ИЦБ) с поручительством ДОМ.РФ. Объем выпуска составил 50 млрд рублей. Спрос со стороны инвесторов превысил предложение в несколько раз. (Это симулированные данные)",
  },
  {
    id: "sim_news3",
    title: "Клиенты Банка ДОМ.РФ жалуются на сбои в работе мобильного приложения (СИМУЛЯЦИЯ)",
    link: "https://example.com/domrf-app-issues",
    source: "Банки.ру (Симуляция)",
    publishDate: getRandomPastDate(2),
    fullText: "В последние несколько дней пользователи мобильного приложения Банка ДОМ.РФ сообщают о периодических сбоях. Представители банка пока не дали официальных комментариев. (Это симулированные данные)",
  },
];


const fetchBankNewsTool = ai.defineTool(
  {
    name: 'fetchBankNewsTool',
    description: 'Получает последние новости из RSS-ленты Яндекс.Новостей и фильтрует их по ключевым словам. В случае ошибки использует симулированные данные.',
    inputSchema: z.object({
      keywords: z.array(z.string()).optional().default(['Банк ДОМ.РФ', 'ДОМ.РФ']),
      count: z.number().optional().default(10).describe("Максимальное количество новостей для возврата после фильтрации."),
    }),
    outputSchema: z.array(RawNewsArticleSchema),
  },
  async (input): Promise<RawNewsArticle[]> => {
    console.log(`[Tool:fetchBankNewsTool] Attempting to fetch news from Yandex RSS. Keywords: ${input.keywords?.join(', ')}, count: ${input.count}`);
    const YANDEX_RSS_URL = 'https://news.yandex.ru/index.rss';
    const parser = new Parser();
    let articlesFromRss: RawNewsArticle[] = [];

    try {
      const feed = await parser.parseURL(YANDEX_RSS_URL);
      console.log(`[Tool:fetchBankNewsTool] Fetched ${feed.items.length} items from Yandex RSS: ${feed.title}`);
      
      articlesFromRss = feed.items.map(item => {
        let fullText = item.contentSnippet || item.content || item.summary || item.title || '';
        if (fullText.length > 1000) { // Keep snippets reasonably sized
            fullText = fullText.substring(0, 997) + '...';
        }
        
        let publishDateStr = '';
        if (item.pubDate) {
            try {
                publishDateStr = new Date(item.pubDate).toISOString().split('T')[0];
            } catch (dateError) {
                console.warn(`[Tool:fetchBankNewsTool] Could not parse date '${item.pubDate}' for item: ${item.title}. Using current date.`);
                publishDateStr = new Date().toISOString().split('T')[0];
            }
        } else {
            publishDateStr = new Date().toISOString().split('T')[0];
        }

        let validLink: string | undefined = undefined;
        if (item.link && typeof item.link === 'string' && item.link.startsWith('http')) {
          try {
            new URL(item.link); // Validate if it's a proper URL
            validLink = item.link;
          } catch (_) {
            console.warn(`[Tool:fetchBankNewsTool] Invalid URL detected for item '${item.title}': ${item.link}. Link will be omitted.`);
          }
        }


        return {
          id: item.guid || item.link || nanoid(),
          title: item.title || 'Без заголовка',
          link: validLink, // Use the validated link or undefined
          source: feed.title || 'Yandex News RSS',
          publishDate: publishDateStr,
          fullText: fullText,
        };
      });

      console.log(`[Tool:fetchBankNewsTool] Successfully parsed ${articlesFromRss.length} articles from RSS.`);

    } catch (error) {
      console.error("[Tool:fetchBankNewsTool] Error fetching or parsing Yandex RSS feed:", error);
      console.warn("[Tool:fetchBankNewsTool] Falling back to simulated news data due to RSS fetch error.");
      // Fallback to simulated data on error
      return simulatedRawNewsData.slice(0, input.count);
    }

    // Filter fetched articles by keywords
    const lowerCaseKeywords = input.keywords?.map(k => k.toLowerCase()) || [];
    let filteredNews : RawNewsArticle[] = [];

    if (lowerCaseKeywords.length > 0) {
        filteredNews = articlesFromRss.filter(news => {
            const titleLower = news.title.toLowerCase();
            const textLower = news.fullText.toLowerCase();
            return lowerCaseKeywords.some(kw => titleLower.includes(kw) || textLower.includes(kw));
        });
    } else {
        // If no keywords, return all fetched (up to count)
        filteredNews = articlesFromRss;
    }
    
    console.log(`[Tool:fetchBankNewsTool] Filtered down to ${filteredNews.length} articles based on keywords. Will return up to ${input.count}.`);
    return filteredNews.slice(0, input.count);
  }
);

// --- Main Flow ---

export async function analyzeNewsFeed(input: AnalyzeNewsFeedInput): Promise<AnalyzeNewsFeedOutput> {
  return analyzeNewsFeedFlow(input);
}

const newsProcessingPrompt = ai.definePrompt({
  name: 'newsProcessingPrompt',
  input: { schema: RawNewsArticleSchema }, 
  output: { schema: ProcessedNewsItemSchema }, 
  prompt: `Проанализируй следующую новость. Определи, касается ли она непосредственно Банка ДОМ.РФ или аффилированных с ним структур (например, самого ДОМ.РФ).

Новость для анализа:
Заголовок: {{{title}}}
Источник: {{{source}}}
Дата публикации: {{{publishDate}}}
{{#if link}}
Ссылка: {{{link}}}
{{else}}
Ссылка: (отсутствует)
{{/if}}
Текст:
{{{fullText}}}

Задачи:
1.  isRelevantToBankDomRf: Определи, релевантна ли эта новость для Банка ДОМ.РФ. Если да, установи true, иначе false. Учитывай упоминания "Банк ДОМ.РФ", "ДОМ.РФ" и их деятельности.
2.  summary: Сформируй очень краткое содержание новости (1-2 предложения) на русском языке. Если новость нерелевантна, в содержании укажи "Новость не относится к Банку ДОМ.РФ".
3.  sentiment: Определи общую тональность новости по отношению к Банку ДОМ.РФ (если она релевантна) или общую тональность новости (если нерелевантна). Возможные значения: "positive", "negative", "neutral".
4.  negativityReason: Если тональность "negative" И новость релевантна Банку ДОМ.РФ, кратко (1 предложение) поясни, в чем заключается негатив. В остальных случаях оставь это поле пустым.
5.  Сохрани исходные id, title, source, publishDate. Если ссылка (link) была предоставлена, сохрани ее, иначе link должен быть undefined.

Верни результат в JSON-формате, соответствующем ProcessedNewsItemSchema.
`,
});


const analyzeNewsFeedFlow = ai.defineFlow(
  {
    name: 'analyzeNewsFeedFlow',
    inputSchema: AnalyzeNewsFeedInputSchema,
    outputSchema: AnalyzeNewsFeedOutputSchema,
  },
  async (input) => {
    console.log('[analyzeNewsFeedFlow] Started with input:', input);
    
    const rawArticles = await fetchBankNewsTool({keywords: input.keywords, count: input.maxItems});

    if (!rawArticles || rawArticles.length === 0) {
      console.log('[analyzeNewsFeedFlow] No raw articles fetched/returned by the tool.');
      return { processedNews: [] };
    }
    console.log(`[analyzeNewsFeedFlow] Tool returned ${rawArticles.length} raw articles.`);

    const processingPromises = rawArticles.map(async (article) => {
      try {
        // The 'link' field in 'article' is already optional (string | undefined) from the tool.
        // RawNewsArticleSchema (input for the prompt) also expects link to be optional.
        const { output } = await newsProcessingPrompt(article); // Pass article directly
        if (!output) {
          console.warn(`[analyzeNewsFeedFlow] AI returned null output for article ID: ${article.id}. Title: ${article.title}`);
          // Provide a default fallback structure for items AI failed to process
          return {
             id: article.id,
             title: article.title,
             summary: "Не удалось обработать новость (AI вернул пустой ответ).",
             source: article.source,
             publishDate: article.publishDate,
             link: article.link, // Pass the potentially undefined link
             sentiment: "neutral" as const,
             isRelevantToBankDomRf: false, 
          };
        }
        // Ensure the output's link matches what was sent, or is undefined if not present in output.
        return { ...output, link: output.link || article.link };
      } catch (error) {
        console.error(`[analyzeNewsFeedFlow] Error processing article ID ${article.id} (Title: ${article.title}):`, error);
        return { 
             id: article.id,
             title: article.title,
             summary: `Ошибка обработки: ${(error as Error).message}`,
             source: article.source,
             publishDate: article.publishDate,
             link: article.link, // Pass the potentially undefined link
             sentiment: "neutral" as const,
             isRelevantToBankDomRf: false, // Assume not relevant if processing failed
          };
      }
    });

    const processedNewsItems = await Promise.all(processingPromises);
    
    // Filter for relevant news *after* AI processing
    const relevantNews = processedNewsItems.filter(news => news.isRelevantToBankDomRf);

    console.log(`[analyzeNewsFeedFlow] Finished. Processed ${processedNewsItems.length} articles from tool, AI found ${relevantNews.length} relevant to Bank DOM.RF.`);
    return { processedNews: relevantNews }; 
  }
);

// Removed export of Zod schemas, only types and the main function are exported.
// export { AnalyzeNewsFeedInputSchema, AnalyzeNewsFeedOutputSchema, ProcessedNewsItemSchema };
// Exporting types is fine:
// export type { AnalyzeNewsFeedInput, AnalyzeNewsFeedOutput, ProcessedNewsItem };
// The main function 'analyzeNewsFeed' is already exported.

    