
"use client";

import type { ChangeEvent } from 'react';
import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileUp, Sparkles, ListChecks, PlusCircle, Trash2, Edit3, Download, Search, AlertTriangle, Info, TableIcon, Settings } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { nanoid } from 'nanoid';
import { cn } from "@/lib/utils";

const ACCEPTABLE_FILE_EXTENSIONS = ".xlsx,.xls";

interface PaymentRecord {
  [key: string]: any;
  __trigger_status__?: string;
  __triggered_by__?: string;
  __matched_keywords__?: string[];
  __original_index__?: number;
}

interface Trigger {
  id: string;
  name: string;
  searchText: string; // Comma-separated list of words/phrases
}

const defaultTriggers: Trigger[] = [
  { id: nanoid(), name: "Общество", searchText: "общество, общества" },
  { id: nanoid(), name: "Уставный капитал", searchText: "уставный капитал" },
  { id: nanoid(), name: "Доли", searchText: "доли, долей" },
  { id: nanoid(), name: "Вложение", searchText: "вложение, вложения" },
  { id: nanoid(), name: "Займ", searchText: "займ" },
  { id: nanoid(), name: "Задолженность", searchText: "задолженность" },
  { id: nanoid(), name: "Долг", searchText: "долг" },
  { id: nanoid(), name: "Возврат", searchText: "возврат" },
  { id: nanoid(), name: "Предоставление", searchText: "предоставление" },
  { id: nanoid(), name: "Приобретение", searchText: "приобретение" },
  { id: nanoid(), name: "Погашение", searchText: "погашение" },
  { id: nanoid(), name: "Договор купли-продажи", searchText: "договор купли продажи, дкп" },
  { id: nanoid(), name: "Земельный участок", searchText: "земельный участок" },
  { id: nanoid(), name: "Имущество", searchText: "имущество" },
  { id: nanoid(), name: "Недвижимость", searchText: "недвиж, недвижимость" },
  { id: nanoid(), name: "Ценные бумаги", searchText: "ценные бумаги" },
  { id: nanoid(), name: "Вексель", searchText: "вексел, вексель" },
  { id: nanoid(), name: "Акции", searchText: "акции" },
];

export default function PaymentTriggerCheck() {
  const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]);
  const [processedPayments, setProcessedPayments] = useState<PaymentRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const [triggers, setTriggers] = useState<Trigger[]>(defaultTriggers);
  const [currentTriggerName, setCurrentTriggerName] = useState('');
  const [currentSearchText, setCurrentSearchText] = useState('');
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileLoadMessage, setFileLoadMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileLoadMessage(null);
    setRawPayments([]);
    setProcessedPayments([]);
    setHeaders([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonPayments: PaymentRecord[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonPayments.length === 0) {
          setFileLoadMessage("Файл пуст или не удалось прочитать данные.");
          toast({ title: "Ошибка файла", description: "Файл пуст или не удалось прочитать данные.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const paymentHeaders = Object.keys(jsonPayments[0] || {});
        setHeaders(paymentHeaders);

        const loadMsg = `Файл "${file.name}" (${jsonPayments.length} строк) успешно загружен. Поиск триггеров будет осуществляться по всем колонкам.`;
        setFileLoadMessage(loadMsg);
        toast({ title: "Файл загружен", description: loadMsg });

        setRawPayments(jsonPayments.map((p, index) => ({ ...p, __original_index__: index })));

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        setFileLoadMessage("Ошибка при чтении или парсинге файла Excel. Убедитесь, что файл корректен.");
        toast({ title: "Ошибка парсинга файла", description: "Не удалось обработать файл Excel.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setFileLoadMessage("Не удалось прочитать файл.");
      toast({ title: "Ошибка чтения файла", variant: "destructive" });
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveTrigger = () => {
    if (!currentTriggerName.trim()) {
      toast({ title: "Ошибка", description: "Название триггера не может быть пустым.", variant: "destructive" });
      return;
    }
    if (!currentSearchText.trim()) {
      toast({ title: "Ошибка", description: "Поисковый текст триггера не может быть пустым.", variant: "destructive" });
      return;
    }

    if (editingTrigger) {
      setTriggers(triggers.map(t => t.id === editingTrigger.id ? { ...editingTrigger, name: currentTriggerName.trim(), searchText: currentSearchText.trim() } : t));
      setEditingTrigger(null);
    } else {
      setTriggers([...triggers, { id: nanoid(), name: currentTriggerName.trim(), searchText: currentSearchText.trim() }]);
    }
    setCurrentTriggerName('');
    setCurrentSearchText('');
    toast({ title: "Триггер сохранен" });
  };

  const handleEditTrigger = (trigger: Trigger) => {
    setEditingTrigger(trigger);
    setCurrentTriggerName(trigger.name);
    setCurrentSearchText(trigger.searchText);
  };

  const handleCancelEditTrigger = () => {
    setEditingTrigger(null);
    setCurrentTriggerName('');
    setCurrentSearchText('');
  }

  const handleRemoveTrigger = (id: string) => {
    setTriggers(triggers.filter(t => t.id !== id));
    if (editingTrigger?.id === id) handleCancelEditTrigger();
  };

  const processPayments = useCallback(() => {
    if (rawPayments.length === 0) {
      toast({ title: "Нет данных", description: "Сначала загрузите реестр платежей.", variant: "destructive" });
      return;
    }
    if (triggers.length === 0) {
      toast({ title: "Нет триггеров", description: "Добавьте хотя бы один триггер для проверки.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    const updatedPayments = rawPayments.map(payment => {
      let status = "не найден";
      let triggeredByName = "";
      let matchedKeywordsForRow: string[] = [];

      for (const trigger of triggers) {
        const searchTerms = trigger.searchText
          .split(',')
          .map(term => term.trim().toLowerCase())
          .filter(Boolean); // Remove empty strings that might result from splitting

        if (searchTerms.length === 0) continue;

        let triggerMatched = false;
        let currentTriggerMatchedTerms: string[] = [];

        for (const header of headers) {
          const cellValue = String(payment[header] ?? '').toLowerCase();
          if (!cellValue) continue;

          for (const term of searchTerms) {
            if (cellValue.includes(term)) {
              triggerMatched = true;
              if (!currentTriggerMatchedTerms.includes(term)) {
                 currentTriggerMatchedTerms.push(term);
              }
            }
          }
        }
        
        if (triggerMatched) {
          status = "найден";
          triggeredByName = trigger.name;
          matchedKeywordsForRow = currentTriggerMatchedTerms;
          break; 
        }
      }
      return { ...payment, __trigger_status__: status, __triggered_by__: triggeredByName, __matched_keywords__: matchedKeywordsForRow };
    });
    setProcessedPayments(updatedPayments);
    setIsProcessing(false);
    toast({ title: "Обработка завершена", description: `Реестр проверен на триггеры. Поиск осуществлялся по всем колонкам.` });
  }, [rawPayments, triggers, headers, toast]);


  const downloadExcel = () => {
    if (processedPayments.length === 0 && rawPayments.length === 0) {
      toast({ title: "Нет данных для экспорта", variant: "destructive" });
      return;
    }
    const dataToExport = (processedPayments.length > 0 ? processedPayments : rawPayments).map(p => {
      const { __trigger_status__, __triggered_by__, __matched_keywords__, __original_index__, ...originalData } = p;
      return {
        ...originalData,
        "Статус Триггера": __trigger_status__ || (processedPayments.length > 0 ? "не найден" : ""),
        "Сработавший Триггер": __triggered_by__ || (processedPayments.length > 0 ? "" : ""),
        "Ключевые слова/фразы триггера": (__matched_keywords__ && __matched_keywords__.length > 0) ? __matched_keywords__.join(', ') : (processedPayments.length > 0 ? "" : ""),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Результаты проверки");
    XLSX.writeFile(workbook, `Результаты_проверки_${fileName || 'реестр'}.xlsx`);
    toast({ title: "Файл экспортирован" });
  };

  const displayHeaders = headers.length > 0
    ? (processedPayments.length > 0 || rawPayments.length > 0 // Show additional headers if there's data to display
      ? [...headers, "Статус Триггера", "Сработавший Триггер", "Ключевые слова/фразы триггера"]
      : headers)
    : [];
  const paymentsToDisplay = processedPayments.length > 0 ? processedPayments : rawPayments;


  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FileUp className="h-7 w-7 text-accent" />
            1. Загрузка реестра платежей
          </CardTitle>
          <CardDescription>
            Загрузите файл Excel (.xlsx, .xls) с реестром платежей. Поиск триггеров будет производиться по всем данным строки.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            id="excel-upload"
            type="file"
            onChange={handleFileChange}
            accept={ACCEPTABLE_FILE_EXTENSIONS}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
            disabled={isLoading}
          />
          {isLoading && <Loader2 className="mt-2 h-5 w-5 animate-spin text-primary" />}
          {fileLoadMessage && !isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">
              {fileLoadMessage}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-7 w-7 text-accent" />
            2. Управление триггерами
          </CardTitle>
          <CardDescription>
            Создайте или отредактируйте триггеры. Каждый триггер содержит имя и поисковый текст (слова или фразы через запятую).
            Поиск будет осуществляться по всем колонкам. Триггер сработает, если хотя бы одна из его поисковых фраз будет найдена.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="p-4 bg-muted/30">
            <h3 className="text-lg font-semibold mb-2">{editingTrigger ? "Редактирование триггера" : "Новый триггер"}</h3>
            <div className="space-y-3">
              <Input
                placeholder="Название триггера (например, 'Высокий риск')"
                value={currentTriggerName}
                onChange={(e) => setCurrentTriggerName(e.target.value)}
              />
              <Textarea
                placeholder="Слова/фразы для поиска через ЗАПЯТУЮ (например, 'срочный платеж, возврат по договору 123, особые условия')"
                value={currentSearchText}
                onChange={(e) => setCurrentSearchText(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveTrigger}>
                  {editingTrigger ? "Сохранить изменения" : "Добавить триггер"}
                </Button>
                {editingTrigger && <Button variant="ghost" onClick={handleCancelEditTrigger}>Отмена</Button>}
              </div>
            </div>
          </Card>

          {triggers.length > 0 && (
            <Accordion type="single" collapsible className="w-full" defaultValue="triggers-list">
              <AccordionItem value="triggers-list">
                <AccordionTrigger className="text-lg hover:no-underline"><ListChecks className="mr-2 h-5 w-5 text-primary" />Сохраненные триггеры ({triggers.length})</AccordionTrigger>
                <AccordionContent className="pt-2 space-y-2">
                  <ScrollArea className="h-40 pr-2">
                    {triggers.map(trigger => (
                      <Card key={trigger.id} className="p-3 mb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-md">{trigger.name}</h4>
                            <p className="text-xs text-muted-foreground">Поисковый текст: "{trigger.searchText}"</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTrigger(trigger)} className="h-7 w-7" title="Редактировать">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTrigger(trigger.id)} className="h-7 w-7" title="Удалить">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={processPayments}
        disabled={isLoading || isProcessing || rawPayments.length === 0 || triggers.length === 0}
        className="w-full text-lg py-6 rounded-lg"
      >
        {isProcessing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Search className="mr-2 h-6 w-6" />}
        3. Запустить проверку реестра
      </Button>

      {(processedPayments.length > 0 || (rawPayments.length > 0 && !isProcessing)) && (
        <Card className="shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <TableIcon className="h-7 w-7 text-accent" />
              4. Результаты проверки
            </CardTitle>
            <CardDescription>
              Таблица с исходными данными и результатами проверки триггеров.
              {processedPayments.length > 0 && 'Новые столбцы: "Статус Триггера", "Сработавший Триггер" и "Ключевые слова/фразы триггера".'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full border rounded-md">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    {displayHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsToDisplay.map((payment, index) => (
                    <TableRow key={payment.__original_index__ ?? index} className={payment.__trigger_status__ === "найден" ? "bg-accent/10 hover:bg-accent/20" : ""}>
                      {headers.map(header => <TableCell key={header}>{String(payment[header] ?? '')}</TableCell>)}
                      {(processedPayments.length > 0 || rawPayments.length > 0) && ( 
                        <>
                          <TableCell>
                            <span className={cn(
                              "font-medium px-2 py-0.5 rounded-full text-xs",
                              payment.__trigger_status__ === "найден" && "bg-green-100 text-green-800",
                              payment.__trigger_status__ === "не найден" && "bg-gray-100 text-gray-700",
                              !payment.__trigger_status__ && processedPayments.length > 0 && "bg-gray-100 text-gray-700"
                            )}>
                              {processedPayments.length > 0 ? (payment.__trigger_status__ || "не найден") : ""}
                            </span>
                          </TableCell>
                          <TableCell>{processedPayments.length > 0 ? (payment.__triggered_by__ || "") : ""}</TableCell>
                          <TableCell>{processedPayments.length > 0 ? ((payment.__matched_keywords__ && payment.__matched_keywords__.length > 0) ? payment.__matched_keywords__.join(', ') : "") : ""}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {paymentsToDisplay.length === 0 && <p className="p-4 text-center text-muted-foreground">Нет данных для отображения. Загрузите файл и запустите проверку.</p>}
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button onClick={downloadExcel} disabled={rawPayments.length === 0} className="w-full">
              <Download className="mr-2 h-5 w-5" />
              Скачать {processedPayments.length > 0 ? "обработанный" : "исходный"} Excel
            </Button>
          </CardFooter>
        </Card>
      )}

      <Card className="shadow-xl rounded-xl opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-muted-foreground">
            <Info className="h-6 w-6" /> Дополнительная информация
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            **Важно:** Обработка файлов Excel происходит в вашем браузере. Для очень больших файлов производительность может снижаться.
          </p>
          <p>
            **Требования к файлу:** Первый лист Excel должен содержать таблицу с платежами, где первая строка - заголовки столбцов.
          </p>
          <p>
            **Логика работы триггеров:** Триггер срабатывает, если **хотя бы одна** из его поисковых фраз (разделенных запятыми в поле "Поисковый текст") найдена в любой ячейке строки.
            Если платеж соответствует нескольким триггерам, будет указан первый сработавший триггер из вашего списка.
          </p>
          <p>
            **Ограничение прав доступа и история предупреждений:** Эти функции на данном этапе не реализованы.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

