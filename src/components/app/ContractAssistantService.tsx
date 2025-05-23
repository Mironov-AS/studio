
"use client";

import type { ChangeEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { processContract, type ProcessContractOutput } from '@/ai/flows/process-contract-flow';
import { chatWithDocument, type ChatWithDocumentOutput } from '@/ai/flows/chat-with-document-flow';
import { Loader2, FileUp, FileText, Sparkles, ListChecks, Users, BarChart3, MessageSquare, Download, Info, FileSignature, Send, User, Bot } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { exportHtmlElementToPdf } from '@/lib/pdfUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';


const ACCEPTABLE_FILE_EXTENSIONS = ".txt,.pdf"; 

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export default function ContractAssistantService() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [manualContractText, setManualContractText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<ProcessContractOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      chatScrollAreaRef.current.scrollTo({ top: chatScrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setManualContractText(''); 
      setAnalysisResult(null);
      setChatHistory([]); // Reset chat on new file
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
    setChatHistory([]); 

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

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    if (!analysisResult && (!fileDataUri && !manualContractText.trim())) {
         toast({ title: 'Ошибка', description: 'Сначала загрузите и обработайте документ.', variant: 'destructive' });
        return;
    }

    const newUserMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const chatContextUri = fileDataUri || undefined;
      const chatContextText = manualContractText.trim() ? manualContractText : undefined;

      if (!chatContextUri && !chatContextText) {
          throw new Error("Контекст документа для чата отсутствует.");
      }

      const result: ChatWithDocumentOutput = await chatWithDocument({
        documentContextUri: chatContextUri,
        documentContextText: chatContextText,
        fileName: file?.name,
        userQuestion: newUserMessage.text,
      });
      
      const aiResponse: ChatMessage = { role: 'ai', text: result.answer };
      setChatHistory(prev => [...prev, aiResponse]);

    } catch (error) {
      console.error("Error in chat:", error);
      const errorMessage = error instanceof Error ? error.message : "Не удалось получить ответ от AI.";
      const aiErrorResponse: ChatMessage = { role: 'ai', text: `Ошибка: ${errorMessage}` };
      setChatHistory(prev => [...prev, aiErrorResponse]);
      toast({ title: 'Ошибка чата', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsChatLoading(false);
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
            Договорной Помощник: Анализ и Чат
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
                  onChange={(e) => { setManualContractText(e.target.value); if (file) setFile(null); setFileDataUri(null); setChatHistory([]); }}
                  placeholder="Вставьте сюда полный текст договора..."
                  rows={10}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleProcessDocument} disabled={isLoading || (!fileDataUri && !manualContractText.trim())} className="w-full text-base py-6 rounded-lg">
            {isLoading && !analysisResult ? (
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
            <Accordion type="single" collapsible defaultValue="summary" className="w-full">
              <AccordionItem value="summary">
                <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Краткая сводка договора</AccordionTrigger>
                <AccordionContent>
                  <Textarea value={analysisResult.contractSummary} readOnly rows={5} className="bg-card border-border p-3 rounded-md shadow-inner whitespace-pre-wrap text-sm" />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="parties">
                <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Стороны договора</AccordionTrigger>
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
                <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Ключевые события и обязательства</AccordionTrigger>
                <AccordionContent>
                  {analysisResult.keyEvents && analysisResult.keyEvents.length > 0 ? (
                    <ScrollArea className="h-72">
                      <div className="space-y-3 pr-2">
                        {analysisResult.keyEvents.map((event, index) => (
                          <Card key={index} className="p-3 bg-secondary/50 shadow-sm border-border">
                            <p className="text-sm"><strong>Дата/Срок:</strong> {event.date || 'Не указана'}</p>
                            <p className="text-sm"><strong>Описание:</strong> {event.description}</p>
                            <p className="text-sm"><strong>Ответственный:</strong> {event.responsibleParty || 'Не указан'}</p>
                            {/* <Button variant="outline" size="sm" className="mt-2 text-xs" disabled>
                              <Sparkles className="mr-1 h-3 w-3" /> Предложить действие (скоро)
                            </Button> */}
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : <p className="text-sm text-muted-foreground">Ключевые события не найдены.</p>}
                </AccordionContent>
              </AccordionItem>
              
              {analysisResult.dispositionCard && Object.keys(analysisResult.dispositionCard).length > 0 && (
                <AccordionItem value="disposition">
                    <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Распоряжение о постановке на учет</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                        {renderDispositionCard(analysisResult.dispositionCard)}
                        <Button onClick={handleExportDispositionCard} variant="outline" className="w-full" disabled={isLoading}>
                            {isLoading && analysisResult ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Выгрузить распоряжение (PDF)
                        </Button>
                    </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      )}
      
      {/* Chatbot Section */}
      {(analysisResult || fileDataUri || manualContractText.trim()) && !isLoading && (
        <Card className="w-full shadow-xl rounded-xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MessageSquare className="h-7 w-7 text-accent" />
              Чат с документом
            </CardTitle>
            <CardDescription>
              Задайте вопрос по содержанию загруженного или введенного документа. Чат станет доступен после обработки документа.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-60 w-full border rounded-md p-4 mb-4 bg-muted/20" ref={chatScrollAreaRef}>
              {chatHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {analysisResult ? "Задайте свой вопрос по документу." : "Сначала загрузите и обработайте документ, чтобы начать чат."}
                </p>
              )}
              {chatHistory.map((msg, index) => (
                <div key={index} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-[75%] shadow ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-br-none' 
                      : 'bg-card text-card-foreground border border-border rounded-bl-none'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                        {msg.role === 'user' ? <User className="h-4 w-4"/> : <Bot className="h-4 w-4"/>}
                        <span className="text-xs font-semibold">{msg.role === 'user' ? 'Вы' : 'AI Ассистент'}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
               {isChatLoading && (
                <div className="flex justify-start mb-3">
                   <div className="p-3 rounded-lg bg-card text-card-foreground border border-border rounded-bl-none shadow">
                    <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4"/>
                        <span className="text-xs font-semibold">AI Ассистент</span>
                    </div>
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                   </div>
                </div>
              )}
            </ScrollArea>
            <div className="flex gap-2">
              <Input 
                type="text"
                placeholder={analysisResult ? "Спросите что-нибудь о документе..." : "Обработайте документ для активации чата"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isChatLoading && handleSendChatMessage()}
                disabled={isChatLoading || (!analysisResult && !(fileDataUri || manualContractText.trim()))}
                className="flex-grow"
              />
              <Button onClick={handleSendChatMessage} disabled={isChatLoading || !chatInput.trim() || (!analysisResult && !(fileDataUri || manualContractText.trim()))}>
                {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Placeholder for other features - Keep this for future context */}
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
          {/* <Button variant="outline" disabled className="w-full justify-start">
            <MessageSquare className="mr-2 h-5 w-5" /> Чат-бот поддержки - Removed as integrated above
          </Button> */}
          <Button variant="outline" disabled className="w-full justify-start">
            <Info className="mr-2 h-5 w-5" /> Справочник событий и инструкции
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

