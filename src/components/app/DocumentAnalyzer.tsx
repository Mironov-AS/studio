
"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { analyzeDocument, type AnalyzeDocumentOutput } from '@/ai/flows/analyze-document-flow'; // Updated type import
import { Loader2, FileUp, FileText, Sparkles, CalendarDays } from 'lucide-react'; // Added CalendarDays

// Updated to reflect backend capabilities: TXT, PDF, and common image formats.
const ACCEPTABLE_FILE_EXTENSIONS = ".txt,.pdf,.png,.jpg,.jpeg,.webp";

export default function DocumentAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeDocumentOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAnalysisResult(null); // Reset previous results
      setFileDataUri(null); // Reset data URI until new one is loaded

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

  const handleAnalyzeDocument = async () => {
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
      const result = await analyzeDocument({ documentDataUri: fileDataUri, fileName: file.name });
      setAnalysisResult(result);
      toast({
        title: 'Анализ завершен',
        description: 'AI успешно проанализировал документ.',
      });
    } catch (error) {
      console.error('Error analyzing document:', error);
      let errorMessage = 'Произошла ошибка при анализе документа.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Ошибка анализа',
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
          <FileText className="h-7 w-7 text-accent" />
          Анализ Документа
        </CardTitle>
        <CardDescription>
          Выберите файл. Поддерживаемые форматы: {ACCEPTABLE_FILE_EXTENSIONS.split(',').join(', ')}. Максимальный размер файла зависит от возможностей модели.
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

        <Button onClick={handleAnalyzeDocument} disabled={isLoading || !file || !fileDataUri} className="w-full text-base py-6 rounded-lg">
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          Анализировать документ
        </Button>

        {analysisResult && (
          <div className="space-y-6 pt-6 border-t mt-6">
            <div>
              <Label htmlFor="document-summary" className="text-lg font-semibold text-primary">Краткая сводка:</Label>
              <Textarea id="document-summary" value={analysisResult.summary} readOnly rows={8} className="mt-2 bg-card border-border p-3 rounded-md shadow-inner whitespace-pre-wrap text-sm" />
            </div>
            <div>
              <Label htmlFor="document-type" className="text-lg font-semibold text-primary">Тип документа:</Label>
              <Input id="document-type" value={analysisResult.documentType} readOnly className="mt-2 bg-card border-border p-3 rounded-md shadow-inner text-sm font-medium" />
            </div>
            {analysisResult.documentDate && (
              <div>
                <Label htmlFor="document-date" className="text-lg font-semibold text-primary flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Дата документа:
                </Label>
                <Input id="document-date" value={analysisResult.documentDate} readOnly className="mt-2 bg-card border-border p-3 rounded-md shadow-inner text-sm font-medium" />
              </div>
            )}
          </div>
        )}
      </CardContent>
      { file && !isLoading && !analysisResult && fileDataUri &&
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
                Файл готов к анализу. Нажмите кнопку выше.
            </p>
        </CardFooter>
      }
    </Card>
  );
}

