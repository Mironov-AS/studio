
"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { processContract, type ProcessContractOutput } from '@/ai/flows/process-contract-flow';
import { Loader2, FileUp, FileText, Sparkles, ListChecks, Users, BarChart3, MessageSquare, Download, Info, FileSignature } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { exportHtmlElementToPdf } from '@/lib/pdfUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const ACCEPTABLE_FILE_EXTENSIONS = ".txt,.pdf"; // Restricted to TXT and PDF as per flow capabilities

export default function ContractControlService() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [manualContractText, setManualContractText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<ProcessContractOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setManualContractText(''); // Clear manual text if file is selected
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
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(null);
      setFileDataUri(null);
    }
  };

  const handleProcessDocument = async () => {
    if (!fileDataUri && !manualContractText.trim()) {
      toast({
        title: 'Нет данных для анализа',
        description: 'Пожалуйста, загрузите файл или введите текст договора.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const inputPayload = {
        documentDataUri: fileDataUri,
        documentText: manualContractText.trim() ? manualContractText : undefined,
        fileName: file?.name,
      };
      const result = await processContract(inputPayload);
      setAnalysisResult(result);
      toast({
        title: 'Обработка завершена',
        description: 'AI успешно проанализировал договор.',
      });
    } catch (error) {
      console.error('Error processing contract:', error);
      let errorMessage = 'Произошла ошибка при обработке договора.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: 'Ошибка обработки',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportDispositionCard = async () => {
    if (!analysisResult?.dispositionCard) {
      toast({ title: 'Ошибка', description: 'Данные для распоряжения отсутствуют.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await exportHtmlElementToPdf('disposition-card-content', `Распоряжение_${analysisResult.dispositionCard.contractNumber || 'бн'}`);
      toast({ title: 'Экспорт успешен', description: 'Распоряжение выгружено в PDF.' });
    } catch (e) {
      toast({ title: 'Ошибка экспорта', description: 'Не удалось создать PDF.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  const renderDispositionCard = (cardData: NonNullable<ProcessContractOutput['dispositionCard']>) => (
    <div id="disposition-card-content" className="p-4 border rounded-md bg-secondary/30 shadow-sm space-y-2 text-sm">
      <h4 className="text-md font-semibold text-primary">Распоряжение о постановке на учет</h4>
      <p><strong>Номер договора:</strong> {cardData.contractNumber || 'Не указан'}</p>
      <p><strong>Дата договора:</strong> {cardData.contractDate || 'Не указана'}</p>
      <p><strong>Стороны договора:</strong> {cardData.partiesInfo || 'Не указаны'}</p>
      <p><strong>Объект учета:</strong> {cardData.objectInfo || 'Не указан'}</p>
      <p><strong>Сумма сделки:</strong> {cardData.dealAmount || 'Не указана'}</p>
      <p><strong>Дата начала действия:</strong> {cardData.startDate || 'Не указана'}</p>
      <p><strong>Ответственный исполнитель (банк):</strong> {cardData.bankExecutorName || 'Не указан'}</p>
    </div>
  );


  return (
    <div className="space-y-6">
      <Card className="w-full shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FileSignature className="h-7 w-7 text-accent" />
            Обработка Договора
          </CardTitle>
          <CardDescription>
            Загрузите файл договора (PDF, TXT) или введите текст вручную. 
            Система проанализирует его, извлечет ключевую информацию и события. 
            Файлы DOC/DOCX необходимо предварительно сконвертировать в PDF или TXT.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">Загрузить файл</TabsTrigger>
              <TabsTrigger value="text">Ввести текст</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="contract-upload" className="font-medium text-base flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-muted-foreground" />
                  Выберите файл договора:
                </Label>
                <Input
                  id="contract-upload"
                  type="file"
                  onChange={handleFileChange}
                  accept={ACCEPTABLE_FILE_EXTENSIONS}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
                />
                {file && (
                  <p className="text-sm text-muted-foreground mt-1">Выбран файл: {file.name} ({(file.size / 1024).toFixed(2)} KB)</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="text" className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="manual-contract-text" className="font-medium text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Введите текст договора:
                </Label>
                <Textarea
                  id="manual-contract-text"
                  value={manualContractText}
                  onChange={(e) => { setManualContractText(e.target.value); if (file) setFile(null); setFileDataUri(null); }}
                  placeholder="Вставьте сюда полный текст договора..."
                  rows={10}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleProcessDocument} disabled={isLoading || (!fileDataUri && !manualContractText.trim())} className="w-full text-base py-6 rounded-lg">
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-5 w-5" />
            )}
            Обработать документ
          </Button>
        </CardContent>
         {(fileDataUri || manualContractText.trim()) && !isLoading && !analysisResult &&
            <CardFooter>
                <p className="text-xs text-muted-foreground text-center w-full">
                    Документ готов к обработке. Нажмите кнопку выше.
                </p>
            </CardFooter>
        }
      </Card>

      {analysisResult && !isLoading && (
        <Card className="w-full shadow-lg rounded-xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ListChecks className="h-7 w-7 text-accent" />
              Результаты Анализа Договора
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Accordion type="single" collapsible defaultValue="summary">
              <AccordionItem value="summary">
                <AccordionTrigger className="text-lg font-semibold text-primary">Краткая сводка договора</AccordionTrigger>
                <AccordionContent>
                  <Textarea value={analysisResult.contractSummary} readOnly rows={5} className="bg-card border-border p-3 rounded-md shadow-inner whitespace-pre-wrap text-sm" />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="parties">
                <AccordionTrigger className="text-lg font-semibold text-primary">Стороны договора</AccordionTrigger>
                <AccordionContent>
                  {analysisResult.parties && analysisResult.parties.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                      {analysisResult.parties.map((party, index) => (
                        <li key={index}><strong>{party.role}:</strong> {party.name}</li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">Стороны не определены.</p>}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="events">
                <AccordionTrigger className="text-lg font-semibold text-primary">Ключевые события и обязательства</AccordionTrigger>
                <AccordionContent>
                  {analysisResult.keyEvents && analysisResult.keyEvents.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                      {analysisResult.keyEvents.map((event, index) => (
                        <Card key={index} className="p-3 bg-secondary/50 shadow-sm border-border">
                          <p className="text-sm"><strong>Дата/Срок:</strong> {event.date || 'Не указана'}</p>
                          <p className="text-sm"><strong>Описание:</strong> {event.description}</p>
                          <p className="text-sm"><strong>Ответственный:</strong> {event.responsibleParty || 'Не указан'}</p>
                          <Button variant="outline" size="sm" className="mt-2 text-xs" disabled>
                            <Sparkles className="mr-1 h-3 w-3" /> Предложить действие (скоро)
                          </Button>
                        </Card>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Ключевые события не найдены.</p>}
                </AccordionContent>
              </AccordionItem>
              
              {analysisResult.dispositionCard && Object.keys(analysisResult.dispositionCard).length > 0 && (
                <AccordionItem value="disposition">
                    <AccordionTrigger className="text-lg font-semibold text-primary">Распоряжение о постановке на учет</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                        {renderDispositionCard(analysisResult.dispositionCard)}
                        <Button onClick={handleExportDispositionCard} variant="outline" className="w-full" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Выгрузить распоряжение (PDF)
                        </Button>
                    </AccordionContent>
                </AccordionItem>
              )}

              {analysisResult.identifiedChanges && (
                 <AccordionItem value="changes">
                    <AccordionTrigger className="text-lg font-semibold text-primary">Выявленные изменения (относительно предыдущей версии)</AccordionTrigger>
                    <AccordionContent>
                        <Textarea value={analysisResult.identifiedChanges} readOnly rows={5} className="bg-card border-border p-3 rounded-md shadow-inner whitespace-pre-wrap text-sm" />
                    </AccordionContent>
                 </AccordionItem>
              )}

              {analysisResult.masterVersionText && (
                 <AccordionItem value="master-text">
                    <AccordionTrigger className="text-lg font-semibold text-primary">Мастер-версия договора (актуальный текст)</AccordionTrigger>
                    <AccordionContent>
                        <Textarea value={analysisResult.masterVersionText} readOnly rows={10} className="bg-card border-border p-3 rounded-md shadow-inner whitespace-pre-wrap text-sm" />
                    </AccordionContent>
                 </AccordionItem>
              )}

            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Placeholders for other features */}
      <Card className="w-full shadow-lg rounded-xl mt-6 opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-muted-foreground">
            Дополнительные Функции (в разработке)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" disabled className="w-full justify-start">
            <Users className="mr-2 h-5 w-5" /> Управление клиентами и договорами
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            <BarChart3 className="mr-2 h-5 w-5" /> Генерация отчетов
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            <MessageSquare className="mr-2 h-5 w-5" /> Чат-бот поддержки
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            <Info className="mr-2 h-5 w-5" /> Справочник событий и инструкции
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
