
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
import Parser from 'rss-parser';

// --- Schemas ---

const RawNewsArticleSchema = z.object({
  id: z.string(),
  title: z.string().optional().describe("Original title of the news article."),
  link: z.string().optional().describe("Link to the original news article. Can be undefined if not available or invalid."),
  source: z.string().optional().describe("Source of the news (e.g., 'Ведомости', 'РБК', 'Yandex News RSS')."),
  publishDate: z.string().optional().describe("Publication date in YYYY-MM-DD format."),
  fullText: z.string().describe("Full text or a significant snippet/description of the news article for analysis."),
});
type RawNewsArticle = z.infer<typeof RawNewsArticleSchema>;

// Schema for what AI returns (more stringy)
const ProcessedNewsItemSchemaAI = z.object({
  id: z.string(),
  title: z.string().optional().describe("Заголовок новости."),
  summary: z.string().describe("Краткое содержание новости (2-3 предложения) на русском языке."),
  source: z.string().optional().describe("Источник новости (например, 'Ведомости', 'РБК')."),
  publishDate: z.string().optional().describe("Дата публикации новости (в формате ГГГГ-ММ-ДД)."),
  link: z.string().optional().describe("Ссылка на оригинальную новость. Может быть невалидным URL или отсутствовать."),
  sentiment: z.string().optional().describe("Окраска новости: 'positive', 'negative', 'neutral' (как строка)."),
  negativityReason: z.string().optional().describe("Если новость негативная, краткое пояснение причин негатива (1-2 предложения) на русском языке."),
  isRelevantToBankDomRf: z.string().optional().describe("Ответ 'да' или 'нет', если новость касается Банка ДОМ.РФ."),
});

// True ProcessedNewsItem type for client use (stricter types)
export type ClientProcessedNewsItem = {
  id: string;
  title?: string;
  summary: string;
  source?: string;
  publishDate?: string;
  link?: string;
  sentiment: "positive" | "negative" | "neutral";
  isRelevantToBankDomRf: boolean;
  negativityReason?: string;
};

// Zod Schema for ClientProcessedNewsItem
const ClientProcessedNewsItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  summary: z.string(),
  source: z.string().optional(),
  publishDate: z.string().optional(),
  link: z.string().optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  isRelevantToBankDomRf: z.boolean(),
  negativityReason: z.string().optional(),
});


const AnalyzeNewsFeedInputSchemaInternal = z.object({
  keywords: z.array(z.string()).optional().default(['Банк ДОМ.РФ', 'ДОМ.РФ']).describe("Ключевые слова для поиска новостей."),
  maxItems: z.number().optional().default(10).describe("Максимальное количество новостей для анализа."),
});
export type AnalyzeNewsFeedInput = z.infer<typeof AnalyzeNewsFeedInputSchemaInternal>;


// For client, the flow will return an array of ClientProcessedNewsItem
export type AnalyzeNewsFeedOutput = {
  processedNews: ClientProcessedNewsItem[];
};
// The schema for the flow's output, matching AnalyzeNewsFeedOutput
const AnalyzeNewsFeedOutputSchema = z.object({
  processedNews: z.array(ClientProcessedNewsItemSchema)
});


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
    console.log(`[Tool:fetchBankNewsTool] Attempting to fetch news. Keywords: ${input.keywords?.join(', ')}, count: ${input.count}`);
    const YANDEX_RSS_URL = 'https://news.yandex.ru/index.rss';
    const parser = new Parser();
    let articlesFromRss: RawNewsArticle[] = [];

    try {
      console.log(`[Tool:fetchBankNewsTool] Fetching from URL: ${YANDEX_RSS_URL}`);
      const feed = await parser.parseURL(YANDEX_RSS_URL);
      console.log(`[Tool:fetchBankNewsTool] Fetched ${feed.items.length} items from RSS: ${feed.title}`);
      
      articlesFromRss = feed.items.map((item, index) => {
        console.log(`[Tool:fetchBankNewsTool] RAW RSS Item ${index + 1}: Title: "${item.title}" Link: "${item.link}" PubDate: "${item.pubDate}"`);
        
        let fullText = String(item.contentSnippet || item.content || item.summary || item.title || '');
        if (fullText.length > 1500) {
            console.warn(`[Tool:fetchBankNewsTool] Truncating fullText for item: "${item.title}"`);
            fullText = fullText.substring(0, 1497) + '...';
        }
        
        let publishDateStr: string | undefined;
        try {
            if (item.pubDate) {
                const parsedDate = new Date(item.pubDate);
                if (isNaN(parsedDate.getTime())) {
                    throw new Error(`Invalid date string: ${item.pubDate}`);
                }
                publishDateStr = parsedDate.toISOString().split('T')[0];
            } else {
                console.warn(`[Tool:fetchBankNewsTool] Missing pubDate for item: "${item.title}". Using current date.`);
                publishDateStr = new Date().toISOString().split('T')[0];
            }
        } catch (dateError: any) {
            console.warn(`[Tool:fetchBankNewsTool] Could not parse date '${item.pubDate}' for item: "${item.title}". Error: ${dateError.message}. Using current date.`);
            publishDateStr = new Date().toISOString().split('T')[0];
        }

        let validLink: string | undefined = undefined;
        if (item.link && typeof item.link === 'string') {
          try {
            new URL(item.link); 
            validLink = item.link;
          } catch (_) {
            console.warn(`[Tool:fetchBankNewsTool] Invalid URL detected for item '${item.title}': ${item.link}. Link will be omitted.`);
          }
        }

        const article: RawNewsArticle = {
          id: String(item.guid || item.link || nanoid()),
          title: String(item.title || 'Без заголовка'),
          link: validLink,
          source: String(feed.title || 'Yandex News RSS'),
          publishDate: publishDateStr,
          fullText: fullText,
        };
        console.log(`[Tool:fetchBankNewsTool] Parsed RawNewsArticle ${index + 1}: ID: ${article.id}, Title: "${article.title}"`);
        return article;
      });

      console.log(`[Tool:fetchBankNewsTool] Successfully parsed ${articlesFromRss.length} articles from RSS.`);

    } catch (error: any) {
      console.error("[Tool:fetchBankNewsTool] Error fetching or parsing RSS feed:", error.message, error.stack);
      console.warn("[Tool:fetchBankNewsTool] Falling back to simulated news data due to RSS fetch error.");
      return simulatedRawNewsData.slice(0, input.count);
    }

    const lowerCaseKeywords = input.keywords?.map(k => k.toLowerCase()) || [];
    let filteredNews : RawNewsArticle[] = [];

    if (lowerCaseKeywords.length > 0) {
        filteredNews = articlesFromRss.filter(news => {
            const titleLower = (news.title || '').toLowerCase();
            const textLower = (news.fullText || '').toLowerCase();
            return lowerCaseKeywords.some(kw => titleLower.includes(kw) || textLower.includes(kw));
        });
    } else {
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
  output: { schema: ProcessedNewsItemSchemaAI }, // AI is expected to return stringy fields
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
1.  isRelevantToBankDomRf: Ответь СТРОКОЙ "да" если новость релевантна для Банка ДОМ.РФ, иначе СТРОКОЙ "нет". Учитывай упоминания "Банк ДОМ.РФ", "ДОМ.РФ" и их деятельности.
2.  summary: Сформируй очень краткое содержание новости (1-2 предложения) на русском языке. Если новость нерелевантна, в содержании укажи "Новость не относится к Банку ДОМ.РФ". Это поле ОБЯЗАТЕЛЬНО.
3.  sentiment: Определи общую тональность новости как СТРОКУ: "positive", "negative" или "neutral".
4.  negativityReason: Если тональность "negative" И новость релевантна Банку ДОМ.РФ, кратко (1 предложение) поясни, в чем заключается негатив. В остальных случаях оставь это поле пустым.
5.  Сохрани исходные id, title, source, publishDate. Если ссылка (link) была предоставлена, сохрани ее, иначе link должен быть undefined.

Верни результат в JSON-формате, соответствующем ProcessedNewsItemSchemaAI.
ID: {{{id}}}
`,
});


const analyzeNewsFeedFlow = ai.defineFlow(
  {
    name: 'analyzeNewsFeedFlow',
    inputSchema: AnalyzeNewsFeedInputSchemaInternal,
    outputSchema: AnalyzeNewsFeedOutputSchema, // Flow returns the client-facing structure
  },
  async (input): Promise<AnalyzeNewsFeedOutput> => {
    console.log('[analyzeNewsFeedFlow] Started with input:', JSON.stringify(input));
    
    const rawArticles = await fetchBankNewsTool({keywords: input.keywords, count: input.maxItems});

    if (!rawArticles || rawArticles.length === 0) {
      console.log('[analyzeNewsFeedFlow] No raw articles fetched/returned by the tool.');
      return { processedNews: [] };
    }
    console.log(`[analyzeNewsFeedFlow] Tool returned ${rawArticles.length} raw articles.`);

    const processingPromises = rawArticles.map(async (article) => {
      try {
        console.log(`[analyzeNewsFeedFlow] Processing article ID: ${article.id}, Title: "${article.title}"`);
        console.log(`[analyzeNewsFeedFlow] Article data being sent to prompt:`, JSON.stringify(article, null, 2));
        
        const { output: aiOutput } = await newsProcessingPrompt(article); 
        
        console.log(`[analyzeNewsFeedFlow] Raw AI Output for article ID ${article.id}:`, JSON.stringify(aiOutput, null, 2));

        if (!aiOutput || !aiOutput.summary) { // Check if summary is present
          console.warn(`[analyzeNewsFeedFlow] AI returned null output or missing summary for article ID: ${article.id}. Title: ${article.title}`);
          return {
             id: article.id || nanoid(),
             title: article.title || "Заголовок отсутствует",
             summary: "Не удалось обработать новость (AI вернул неполный или пустой ответ).",
             source: article.source,
             publishDate: article.publishDate,
             link: article.link, 
             sentiment: "neutral" as const,
             isRelevantToBankDomRf: false, 
             negativityReason: undefined,
          } as ClientProcessedNewsItem;
        }
        
        // Transform AI string output to client-expected types
        const clientItem: ClientProcessedNewsItem = {
            id: aiOutput.id || article.id || nanoid(),
            title: aiOutput.title || article.title,
            summary: aiOutput.summary, // summary is required
            source: aiOutput.source || article.source,
            publishDate: aiOutput.publishDate || article.publishDate,
            link: aiOutput.link || article.link,
            sentiment: (aiOutput.sentiment === "positive" || aiOutput.sentiment === "negative") ? aiOutput.sentiment : "neutral",
            isRelevantToBankDomRf: (aiOutput.isRelevantToBankDomRf || '').toLowerCase() === "да",
            negativityReason: aiOutput.negativityReason,
        };
        
        console.log(`[analyzeNewsFeedFlow] Successfully processed and transformed article ID: ${clientItem.id}. Relevant: ${clientItem.isRelevantToBankDomRf}, Sentiment: ${clientItem.sentiment}`);
        return clientItem;
      } catch (error: any) {
        console.error(`[analyzeNewsFeedFlow] Error processing article ID ${article.id} (Title: ${article.title}):`, error.message, error.stack);
        return { 
             id: article.id || nanoid(),
             title: article.title || "Заголовок отсутствует",
             summary: `Ошибка обработки: ${error.message}`,
             source: article.source,
             publishDate: article.publishDate,
             link: article.link, 
             sentiment: "neutral" as const,
             isRelevantToBankDomRf: false, 
             negativityReason: undefined,
          } as ClientProcessedNewsItem;
      }
    });

    const processedNewsItems: ClientProcessedNewsItem[] = await Promise.all(processingPromises);
    
    const relevantNews = processedNewsItems.filter(news => news.isRelevantToBankDomRf);

    console.log(`[analyzeNewsFeedFlow] Finished. Processed ${processedNewsItems.length} articles from tool, AI found ${relevantNews.length} relevant to Bank DOM.RF.`);
    return { processedNews: relevantNews }; 
  }
);
    

