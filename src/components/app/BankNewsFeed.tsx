
"use client";

import { useState, useEffect, useCallback } from 'react';
import { analyzeNewsFeed, type AnalyzeNewsFeedOutput, type ProcessedNewsItem } from '@/ai/flows/analyze-news-feed-flow';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, AlertTriangle, Newspaper, BadgeInfo, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from "@/lib/utils"; // Ensure this import is present

const UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export default function BankNewsFeed() {
  const [newsItems, setNewsItems] = useState<ProcessedNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = useCallback(async (isManualRefresh = false) => {
    if (!isManualRefresh) setIsLoading(true);
    setError(null);
    try {
      const result: AnalyzeNewsFeedOutput = await analyzeNewsFeed({
        // You can pass keywords or maxItems here if your flow input supports it
        keywords: ['Банк ДОМ.РФ', 'ДОМ.РФ'],
        maxItems: 10,
      });
      // Sort by date descending, most recent first
      const sortedNews = result.processedNews.sort((a, b) => 
        new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
      );
      setNewsItems(sortedNews);
      setLastUpdated(new Date());
      if (isManualRefresh) {
        toast({ title: "Новости обновлены", description: "Лента новостей успешно загружена." });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка при загрузке новостей.";
      setError(errorMessage);
      console.error("Error fetching news feed:", err);
      toast({ title: "Ошибка загрузки новостей", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNews(); // Initial fetch
    const intervalId = setInterval(() => fetchNews(), UPDATE_INTERVAL_MS);
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchNews]);

  const getSentimentBadgeVariant = (sentiment: ProcessedNewsItem['sentiment']): "default" | "destructive" | "secondary" => {
    switch (sentiment) {
      case 'positive': return 'default'; // Green in default theme
      case 'negative': return 'destructive';
      case 'neutral': return 'secondary';
      default: return 'secondary';
    }
  };
  
  const getSentimentBadgeText = (sentiment: ProcessedNewsItem['sentiment']): string => {
    switch (sentiment) {
      case 'positive': return 'Позитивная';
      case 'negative': return 'Негативная';
      case 'neutral': return 'Нейтральная';
      default: return 'Неизвестно';
    }
  };

  return (
    <Card className="shadow-xl rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Newspaper className="h-7 w-7 text-accent" />
            Новостная Лента
          </CardTitle>
          <CardDescription>
            {lastUpdated ? `Последнее обновление: ${format(lastUpdated, "dd.MM.yyyy HH:mm:ss", { locale: ru })}` : "Загрузка..."}
          </CardDescription>
        </div>
        <Button onClick={() => fetchNews(true)} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          Обновить
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && newsItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Загрузка новостей...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-60 text-destructive">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <p className="font-semibold">Ошибка загрузки новостей</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
            <BadgeInfo className="h-12 w-12 mb-4" />
            <p>Новостей о Банке ДОМ.РФ не найдено.</p>
            <p className="text-xs">(Данные для этого сервиса симулируются)</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {newsItems.map((item) => (
                <Card key={item.id} className={cn(
                  "transition-all hover:shadow-md",
                  item.sentiment === 'negative' && "bg-destructive/5 border-destructive/30"
                )}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-lg leading-tight">{item.title}</CardTitle>
                        <Badge variant={getSentimentBadgeVariant(item.sentiment)} className="text-xs whitespace-nowrap shrink-0">
                            {getSentimentBadgeText(item.sentiment)}
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {item.source} - {format(parseISO(item.publishDate), "dd MMMM yyyy, HH:mm", { locale: ru })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{item.summary}</p>
                    {item.sentiment === 'negative' && item.negativityReason && (
                      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-destructive text-xs font-semibold flex items-center gap-1">
                            <AlertCircle className="h-4 w-4"/> Пояснение негатива:
                        </p>
                        <p className="text-destructive/90 text-xs mt-1">{item.negativityReason}</p>
                      </div>
                    )}
                  </CardContent>
                  {item.link && (
                    <CardFooter>
                      <Button variant="ghost" size="sm" asChild className="text-xs text-accent">
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          Читать полностью <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground text-center w-full">
          Новостная лента обновляется автоматически каждые 10 минут. Данные симулированы для демонстрации.
        </p>
      </CardFooter>
    </Card>
  );
}
