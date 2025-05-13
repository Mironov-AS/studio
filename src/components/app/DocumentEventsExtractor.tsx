"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { extractDocumentEvents, ExtractDocumentEventsOutput } from '@/ai/flows/extract-document-events-flow';
import { Loader2, FileUp, CalendarClock, Sparkles, ListChecks } from 'lucide-react';

const ACCEPTABLE_FILE_EXTENSIONS = ".txt,.pdf,.png,.jpg,.jpeg,.webp";

export default function DocumentEventsExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractDocumentEventsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAnalysisResult(null); 
      setFileDataUri(null); 

      const reader = new FileReader();
      reader.onloadend = () => {
        setFileDataUri(reader.result as string);
      };
      reader.onerror = () => {
        toast({
          title: 'Ошибка чтения файла',
          description: 'Не удалось прочитать выбранный файл.',
          variant: 'destructive',
        });
        setFileDataUri(null);
        setFile(null);
      }
      reader.readAsDataURL(selectedFile);
    } else {
        setFile(null);
        setFileDataUri(null);
    }
  };

  const handleExtractEvents = async () => {
    if (!file || !fileDataUri) {
      toast({
        title: 'Файл не выбран',
        description: 'Пожалуйста, выберите файл для анализа.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const result = await extractDocumentEvents({ documentDataUri: fileDataUri, fileName: file.name });
      setAnalysisResult(result);
      toast({
        title: 'Извлечение событий завершено',
        description: 'AI успешно обработал документ.',
      });
    } catch (error) {
      console.error('Error extracting events:', error);
      let errorMessage = 'Произошла ошибка при извлечении событий.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Ошибка извлечения',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CalendarClock className="h-7 w-7 text-accent" />
          Извлечение Событий
        </CardTitle>
        <CardDescription>
          Выберите файл. Поддерживаемые форматы: {ACCEPTABLE_FILE_EXTENSIONS.split(',').join(', ')}. AI найдет события и их даты.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="document-upload" className="font-medium text-base flex items-center gap-2">
            <FileUp className="h-5 w-5 text-muted-foreground"/>
            Выберите файл для анализа:
          </Label>
          <Input 
            id="document-upload" 
            type="file" 
            onChange={handleFileChange} 
            accept={ACCEPTABLE_FILE_EXTENSIONS}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
          />
          {file && (
            <p className="text-sm text-muted-foreground mt-1">Выбран файл: {file.name} ({ (file.size / 1024).toFixed(2) } KB)</p>
          )}
        </div>

        <Button onClick={handleExtractEvents} disabled={isLoading || !file || !fileDataUri} className="w-full text-base py-6 rounded-lg">
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          Извлечь события
        </Button>

        {analysisResult && (
          <div className="space-y-6 pt-6 border-t mt-6">
            <Label className="text-lg font-semibold text-primary flex items-center gap-2">
                <ListChecks className="h-6 w-6" />
                Извлеченные события:
            </Label>
            {analysisResult.events && analysisResult.events.length > 0 ? (
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                <ol className="list-decimal list-inside space-y-3 text-sm">
                  {analysisResult.events.map((event, index) => (
                    <li key={index} className="p-3 bg-secondary/50 rounded-md shadow-sm border border-border">
                      <strong className="text-primary-foreground">{event.date || 'Дата не указана'}:</strong>
                      <p className="text-muted-foreground ml-1 whitespace-pre-wrap">{event.description}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">События не найдены в документе.</p>
            )}
          </div>
        )}
      </CardContent>
      { file && !isLoading && !analysisResult && fileDataUri &&
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
                Файл готов к извлечению событий. Нажмите кнопку выше.
            </p>
        </CardFooter>
      }
    </Card>
  );
}
