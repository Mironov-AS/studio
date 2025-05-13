
"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateArchitecturalSketches, GenerateArchitecturalSketchesOutput } from '@/ai/flows/generate-architectural-sketches-flow';
import { Loader2, FileUp, Architecture, Sparkles, Image as ImageIcon, Download } from 'lucide-react';

const ACCEPTABLE_FILE_EXTENSIONS = ".txt,.pdf,.png,.jpg,.jpeg,.webp";

export default function ArchitecturalSketchesGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setGeneratedImageUrl(null); // Reset previous results
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

  const handleGenerateSketches = async () => {
    if (!file || !fileDataUri) {
      toast({
        title: 'Файл не выбран',
        description: 'Пожалуйста, выберите файл технического задания.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setGeneratedImageUrl(null);

    try {
      const result: GenerateArchitecturalSketchesOutput = await generateArchitecturalSketches({ 
        techSpecDataUri: fileDataUri, 
        fileName: file.name 
      });
      
      if (result.imageUrl) {
        setGeneratedImageUrl(result.imageUrl);
        toast({
          title: 'Генерация завершена',
          description: 'AI успешно сгенерировал архитектурные скетчи.',
        });
      } else {
        throw new Error('AI не вернул изображение.');
      }
    } catch (error) {
      console.error('Error generating architectural sketches:', error);
      let errorMessage = 'Произошла ошибка при генерации скетчей.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Ошибка генерации',
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
          <Architecture className="h-7 w-7 text-accent" />
          Генератор Архитектурных Скетчей
        </CardTitle>
        <CardDescription>
          Выберите файл технического задания. Поддерживаемые форматы: {ACCEPTABLE_FILE_EXTENSIONS.split(',').join(', ')}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="tech-spec-upload" className="font-medium text-base flex items-center gap-2">
            <FileUp className="h-5 w-5 text-muted-foreground"/>
            Выберите файл ТЗ:
          </Label>
          <Input 
            id="tech-spec-upload" 
            type="file" 
            onChange={handleFileChange} 
            accept={ACCEPTABLE_FILE_EXTENSIONS}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
          />
          {file && (
            <p className="text-sm text-muted-foreground mt-1">Выбран файл: {file.name} ({ (file.size / 1024).toFixed(2) } KB)</p>
          )}
        </div>

        <Button onClick={handleGenerateSketches} disabled={isLoading || !file || !fileDataUri} className="w-full text-base py-6 rounded-lg">
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          Сгенерировать скетчи
        </Button>

        {isLoading && (
          <div className="flex flex-col items-center justify-center p-6 border-t mt-6">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">AI генерирует архитектурные скетчи... Это может занять некоторое время.</p>
          </div>
        )}

        {generatedImageUrl && !isLoading && (
          <div className="space-y-4 pt-6 border-t mt-6">
            <Label className="text-lg font-semibold text-primary flex items-center gap-2">
                <ImageIcon className="h-6 w-6" />
                Сгенерированное изображение:
            </Label>
            <div className="border rounded-md overflow-hidden shadow-inner bg-muted/20 p-2">
              <Image 
                src={generatedImageUrl} 
                alt="Сгенерированные архитектурные скетчи" 
                width={800} 
                height={600} 
                data-ai-hint="architecture diagram"
                className="w-full h-auto object-contain rounded" 
              />
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href={generatedImageUrl} download={`architectural_sketches_${file?.name.split('.')[0] || 'download'}.png`}>
                <Download className="mr-2 h-4 w-4" />
                Скачать изображение
              </a>
            </Button>
          </div>
        )}
      </CardContent>
      { file && !isLoading && !generatedImageUrl && fileDataUri &&
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
                Файл готов к генерации скетчей. Нажмите кнопку выше.
            </p>
        </CardFooter>
      }
    </Card>
  );
}
