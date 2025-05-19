
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { verifyDduAgainstChecklist, type VerifyDduInput, type VerifyDduOutput, type VerifiedItem } from '@/ai/flows/verify-ddu-flow';
import { Loader2, FileUp, Sparkles, CalendarIcon, ListChecks, PlusCircle, Trash2, Edit3, FileCheck2, Download, FileWarningIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportHtmlElementToPdf } from '@/lib/pdfUtils';


const ACCEPTABLE_FILE_EXTENSIONS = ".pdf";

interface ChecklistItem {
  id: string;
  text: string;
}

interface VerificationResultDisplayItem extends VerifiedItem {
  userComment: string;
}

export default function KskbDduCheck() {
  const [projectCompletionDate, setProjectCompletionDate] = useState<Date | undefined>(undefined);
  const [dduFile, setDduFile] = useState<File | null>(null);
  const [dduFileDataUri, setDduFileDataUri] = useState<string | null>(null);
  
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');

  const [verificationResults, setVerificationResults] = useState<VerificationResultDisplayItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: 'Неверный формат файла',
          description: 'Пожалуйста, загрузите файл в формате PDF.',
          variant: 'destructive',
        });
        setDduFile(null);
        setDduFileDataUri(null);
        event.target.value = ''; // Clear the input
        return;
      }
      setDduFile(selectedFile);
      setVerificationResults(null); 
      setDduFileDataUri(null); 

      const reader = new FileReader();
      reader.onloadend = () => {
        setDduFileDataUri(reader.result as string);
      };
      reader.onerror = () => {
        toast({
          title: 'Ошибка чтения файла',
          description: 'Не удалось прочитать выбранный файл.',
          variant: 'destructive',
        });
        setDduFileDataUri(null);
        setDduFile(null);
      }
      reader.readAsDataURL(selectedFile);
    } else {
        setDduFile(null);
        setDduFileDataUri(null);
    }
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItemText.trim() === '') {
      toast({ title: 'Ошибка', description: 'Текст пункта чек-листа не может быть пустым.', variant: 'destructive' });
      return;
    }
    setChecklistItems([...checklistItems, { id: Date.now().toString(), text: newChecklistItemText.trim() }]);
    setNewChecklistItemText('');
  };

  const handleRemoveChecklistItem = (idToRemove: string) => {
    setChecklistItems(checklistItems.filter(item => item.id !== idToRemove));
  };

  const handleStartEdit = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditingItemText(item.text);
  };

  const handleSaveEdit = (idToSave: string) => {
    if (editingItemText.trim() === '') {
      toast({ title: 'Ошибка', description: 'Текст пункта чек-листа не может быть пустым.', variant: 'destructive' });
      return;
    }
    setChecklistItems(checklistItems.map(item => item.id === idToSave ? { ...item, text: editingItemText.trim() } : item));
    setEditingItemId(null);
    setEditingItemText('');
  };
  
  const handleUserCommentChange = (itemId: string, comment: string) => {
    setVerificationResults(prevResults => 
      prevResults?.map(item => 
        item.originalChecklistItemId === itemId ? { ...item, userComment: comment } : item
      ) || null
    );
  };

  const handleVerifyDdu = async () => {
    if (!dduFile || !dduFileDataUri) {
      toast({ title: 'Файл не выбран', description: 'Пожалуйста, загрузите файл ДДУ.', variant: 'destructive' });
      return;
    }
    if (checklistItems.length === 0) {
      toast({ title: 'Ошибка', description: 'Пожалуйста, добавьте хотя бы один пункт в чек-лист.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setVerificationResults(null);

    const input: VerifyDduInput = {
      projectCompletionDate: projectCompletionDate ? format(projectCompletionDate, "yyyy-MM-dd") : undefined,
      dduDocumentDataUri: dduFileDataUri,
      checklist: checklistItems,
    };

    try {
      const result: VerifyDduOutput = await verifyDduAgainstChecklist(input);
      setVerificationResults(result.verifiedItems.map(item => ({ ...item, userComment: '' })));
      toast({
        title: 'Проверка завершена',
        description: 'AI успешно проанализировал ДДУ по чек-листу.',
      });
    } catch (error) {
      console.error('Error verifying DDU:', error);
      toast({
        title: 'Ошибка проверки',
        description: error instanceof Error ? error.message : "Не удалось выполнить проверку.",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExportResults = async () => {
    if (!verificationResults) {
        toast({ title: 'Нет данных для экспорта', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    try {
        await exportHtmlElementToPdf('verification-results-table', `Результаты_проверки_ДДУ_${dduFile?.name.split('.')[0] || 'отчет'}`);
        toast({ title: 'Экспорт успешен', description: 'Отчет выгружен в PDF.' });
    } catch (e) {
        console.error('PDF Export Error:', e);
        toast({ title: 'Ошибка экспорта', description: 'Не удалось создать PDF.', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <Card className="w-full shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <FileCheck2 className="h-8 w-8 text-accent" />
            КСКБ: Проверка ДДУ по Чек-листу
          </CardTitle>
          <CardDescription>
            Загрузите проект ДДУ (PDF), укажите (необязательно) срок ввода объекта и заполните чек-лист для автоматической проверки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="project-completion-date" className="font-medium">Срок ввода объекта в эксплуатацию (необязательно)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !projectCompletionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {projectCompletionDate ? format(projectCompletionDate, "PPP", { locale: ru }) : <span>Выберите дату</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={projectCompletionDate}
                    onSelect={setProjectCompletionDate}
                    initialFocus
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ddu-upload" className="font-medium">Проект ДДУ (PDF)</Label>
              <Input 
                id="ddu-upload" 
                type="file" 
                onChange={handleFileChange} 
                accept={ACCEPTABLE_FILE_EXTENSIONS}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
              />
              {dduFile && (
                <p className="text-xs text-muted-foreground mt-1">Выбран файл: {dduFile.name} ({ (dduFile.size / 1024).toFixed(2) } KB)</p>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary"/>Чек-лист проверки</CardTitle>
              <CardDescription>Добавьте, отредактируйте или удалите пункты для проверки ДДУ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea 
                  value={newChecklistItemText} 
                  onChange={(e) => setNewChecklistItemText(e.target.value)}
                  placeholder="Введите текст нового пункта чек-листа..."
                  rows={2}
                  className="flex-grow"
                />
                <Button onClick={handleAddChecklistItem} size="icon" variant="outline" className="shrink-0 mt-auto h-full" title="Добавить пункт">
                  <PlusCircle className="h-5 w-5"/>
                </Button>
              </div>
              {checklistItems.length > 0 && (
                <ScrollArea className="h-60 border rounded-md p-2">
                  <ul className="space-y-3">
                    {checklistItems.map((item, index) => (
                      <li key={item.id} className="p-3 bg-muted/50 rounded-md shadow-sm flex items-start gap-2">
                        <span className="font-medium text-sm pt-2">{index + 1}.</span>
                        {editingItemId === item.id ? (
                          <Textarea 
                            value={editingItemText}
                            onChange={(e) => setEditingItemText(e.target.value)}
                            rows={2}
                            className="flex-grow bg-background"
                            onBlur={() => handleSaveEdit(item.id)}
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm flex-grow pt-2 break-words whitespace-pre-wrap min-h-[40px]">{item.text}</p>
                        )}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button onClick={() => editingItemId === item.id ? handleSaveEdit(item.id) : handleStartEdit(item)} size="icon" variant="ghost" className="h-7 w-7" title={editingItemId === item.id ? "Сохранить" : "Редактировать"}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => handleRemoveChecklistItem(item.id)} size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Удалить">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Button 
            onClick={handleVerifyDdu} 
            disabled={isLoading || !dduFile || checklistItems.length === 0} 
            className="w-full text-lg py-6 rounded-lg"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-6 w-6" />
            )}
            Запустить проверку ДДУ
          </Button>
        </CardContent>
        { dduFile && checklistItems.length > 0 && !isLoading && !verificationResults &&
            <CardFooter>
                <p className="text-xs text-muted-foreground text-center w-full">
                    Все данные готовы к проверке. Нажмите кнопку выше.
                </p>
            </CardFooter>
        }
      </Card>

      {isLoading && verificationResults === null && (
        <Card className="mt-6 shadow-lg rounded-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-lg text-muted-foreground">AI анализирует ДДУ по вашему чек-листу... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {verificationResults && !isLoading && (
        <Card className="mt-6 shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ListChecks className="h-7 w-7 text-accent" />
              Результаты проверки ДДУ
            </CardTitle>
            <CardDescription>Ниже представлена таблица соответствия ДДУ пунктам вашего чек-листа. Вы можете добавить свои комментарии.</CardDescription>
          </CardHeader>
          <CardContent>
            <div id="verification-results-table" className="p-2"> {/* Wrapper for PDF export */}
            <h3 className="text-lg font-semibold mb-2 text-center">Отчет о проверке ДДУ</h3>
            <p className="text-sm text-muted-foreground mb-1 text-center">Документ: {dduFile?.name}</p>
            <p className="text-sm text-muted-foreground mb-3 text-center">Срок ввода объекта: {projectCompletionDate ? format(projectCompletionDate, "dd.MM.yyyy") : 'Не указан'}</p>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">№</TableHead>
                  <TableHead>Пункт чек-листа / Требование</TableHead>
                  <TableHead className="w-[150px]">Статус от AI</TableHead>
                  <TableHead>Комментарий AI / Цитата из ДДУ</TableHead>
                  <TableHead className="print-hide">Комментарий пользователя</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verificationResults.map((item, index) => (
                  <TableRow key={item.originalChecklistItemId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="whitespace-pre-wrap break-words">{item.checklistItemText}</TableCell>
                    <TableCell>
                        <span className={cn(
                            "font-medium px-2 py-1 rounded-full text-xs",
                            item.status === "соответствует" && "bg-green-100 text-green-700",
                            item.status === "не соответствует" && "bg-red-100 text-red-700",
                            item.status === "частично соответствует" && "bg-yellow-100 text-yellow-700",
                            item.status === "не удалось определить" && "bg-gray-100 text-gray-700"
                        )}>
                            {item.status}
                        </span>
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap break-words text-xs">{item.systemComment || '-'}</TableCell>
                    <TableCell className="print-hide">
                      <Textarea 
                        value={item.userComment}
                        onChange={(e) => handleUserCommentChange(item.originalChecklistItemId, e.target.value)}
                        placeholder="Ваш комментарий..."
                        rows={2}
                        className="text-xs"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
             <style jsx global>{`
                @media print {
                  .print-hide {
                    display: none !important;
                  }
                  body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                }
            `}</style>
            </div>
             <Button onClick={handleExportResults} variant="outline" className="w-full mt-4 print-hide" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Выгрузить результаты (PDF)
            </Button>
            {verificationResults.length === 0 && (
                <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2">
                    <FileWarningIcon className="w-10 h-10" />
                    <p>Похоже, AI не смог обработать чек-лист или документ. Пожалуйста, проверьте входные данные и попробуйте снова.</p>
                </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

