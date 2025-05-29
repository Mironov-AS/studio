
"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { generateTechSpecFromBacklog, type GenerateTechSpecFromBacklogOutput } from '@/ai/flows/generateTechSpecFromBacklogFlow';
import { Loader2, FileUp, Sparkles, FileCog, DownloadCloudIcon } from 'lucide-react';

const ACCEPTABLE_FILE_EXTENSIONS = ".xlsx,.xls";

export default function TechSpecBCGenerator() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [backlogDataJsonString, setBacklogDataJsonString] = useState<string | null>(null);
  const [generatedTechSpec, setGeneratedTechSpec] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setExcelFile(null);
      setBacklogDataJsonString(null);
      setGeneratedTechSpec(null);
      return;
    }

    setExcelFile(file);
    setGeneratedTechSpec(null); 
    setIsLoading(true); 

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          toast({ title: "Файл пуст", description: "Загруженный Excel-файл не содержит данных.", variant: "destructive" });
          setBacklogDataJsonString(null);
          setExcelFile(null);
          setIsLoading(false);
          event.target.value = ''; // Clear file input
          return;
        }
        setBacklogDataJsonString(JSON.stringify(jsonData));
        toast({ title: "Файл загружен", description: `"${file.name}" успешно обработан и готов к генерации ТЗ.` });
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ title: "Ошибка парсинга файла", description: "Не удалось обработать файл Excel.", variant: "destructive" });
        setBacklogDataJsonString(null);
        setExcelFile(null);
         event.target.value = ''; // Clear file input
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      toast({ title: "Ошибка чтения файла", variant: "destructive" });
      setExcelFile(null);
      setBacklogDataJsonString(null);
      setIsLoading(false);
       event.target.value = ''; // Clear file input
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerateSpec = async () => {
    if (!backlogDataJsonString) {
      toast({
        title: 'Файл не загружен',
        description: 'Пожалуйста, сначала загрузите Excel-файл с бэклогом.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setGeneratedTechSpec(null);

    try {
      const result: GenerateTechSpecFromBacklogOutput = await generateTechSpecFromBacklog({
        backlogDataJsonString: backlogDataJsonString,
        fileName: excelFile?.name
      });
      
      if (result.techSpec.startsWith("Ошибка:")) {
        toast({ title: 'Ошибка от AI', description: result.techSpec, variant: 'destructive' });
        setGeneratedTechSpec(null);
      } else {
        setGeneratedTechSpec(result.techSpec);
        toast({
          title: 'ТЗ успешно сгенерировано!',
          description: 'Проверьте результат ниже.',
        });
      }
    } catch (error) {
      console.error('Error generating tech spec:', error);
      let errorMessage = 'Произошла ошибка при генерации ТЗ.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: 'Ошибка генерации ТЗ',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownloadTxt = () => {
    if (!generatedTechSpec) {
      toast({ title: "Нет данных для скачивания", variant: "destructive" });
      return;
    }
    const blob = new Blob([generatedTechSpec], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const fileName = excelFile?.name.replace(/\.[^/.]+$/, "") || "document";
    link.download = `ТЗ_для_БК_${fileName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Файл ТЗ скачан" });
  };


  return (
    <div className="space-y-6">
      <Card className="w-full shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FileUp className="h-7 w-7 text-accent" />
            1. Загрузка Excel-файла с бэклогом
          </CardTitle>
          <CardDescription>
            Загрузите файл Excel (.xlsx, .xls) с бэклогом доработок.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="excel-backlog-upload">Выберите файл:</Label>
            <Input
              id="excel-backlog-upload"
              type="file"
              onChange={handleFileChange}
              accept={ACCEPTABLE_FILE_EXTENSIONS}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
              disabled={isLoading && !backlogDataJsonString} // Disable while parsing
            />
            {excelFile && !isLoading && backlogDataJsonString && (
              <p className="text-sm text-muted-foreground mt-1">Файл: {excelFile.name} ({ (excelFile.size / 1024).toFixed(2) } KB) готов к генерации ТЗ.</p>
            )}
             {excelFile && isLoading && !backlogDataJsonString && ( // Show loading during file parse
              <p className="text-sm text-muted-foreground mt-1 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Обработка файла {excelFile.name}...</p>
            )}
          </div>
          <Button 
            onClick={handleGenerateSpec} 
            disabled={isLoading || !backlogDataJsonString} 
            className="w-full text-base py-3"
          >
            {isLoading && generatedTechSpec === null ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Сгенерировать ТЗ для БК
          </Button>
        </CardContent>
      </Card>

      {isLoading && generatedTechSpec === null && ( // Show this loading state only when AI is working
        <Card className="mt-6 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-md text-muted-foreground">AI анализирует ваш бэклог и готовит техническое задание... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {generatedTechSpec && !isLoading && (
        <Card className="mt-6 shadow-xl rounded-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileCog className="h-7 w-7 text-accent" />
                Сгенерированное Техническое Задание (ТЗ)
              </CardTitle>
              <Button onClick={handleDownloadTxt} variant="outline" size="sm" >
                <DownloadCloudIcon className="mr-2 h-4 w-4" /> Скачать ТЗ (.txt)
              </Button>
            </div>
            <CardDescription>
              Ниже представлено ТЗ, сгенерированное на основе вашего бэклога. Вы можете скопировать этот текст.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={generatedTechSpec}
              readOnly
              rows={25}
              className="w-full text-sm bg-muted/30 whitespace-pre-wrap"
              placeholder="Техническое задание будет отображено здесь..."
            />
          </CardContent>
           <CardFooter>
                <p className="text-xs text-muted-foreground">
                    Вы можете скопировать текст ТЗ выше или скачать его как .txt файл. Для импорта в Word, просто скопируйте текст.
                </p>
            </CardFooter>
        </Card>
      )}
    </div>
  );
}
