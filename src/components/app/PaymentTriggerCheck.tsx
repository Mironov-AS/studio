
"use client";

import type { ChangeEvent } from 'react';
import { useState, useCallback, useEffect } from 'react';
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
import { nanoid } from 'nanoid'; // For unique IDs
import { cn } from "@/lib/utils"; // Added missing import

const ACCEPTABLE_FILE_EXTENSIONS = ".xlsx,.xls";

interface PaymentRecord {
  [key: string]: any; // Allows any properties from Excel
  __trigger_status__?: string; // "найден" | "не найден"
  __triggered_by__?: string; // Name of the trigger
  __original_index__?: number; // To maintain order
}

interface TriggerCriterion {
  id: string;
  columnHeader: string;
  searchText: string;
}

interface Trigger {
  id: string;
  name: string;
  criteria: TriggerCriterion[];
}

export default function PaymentTriggerCheck() {
  const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]);
  const [processedPayments, setProcessedPayments] = useState<PaymentRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [currentTriggerName, setCurrentTriggerName] = useState('');
  const [currentCriteria, setCurrentCriteria] = useState<TriggerCriterion[]>([]);
  const [currentCriterionColumn, setCurrentCriterionColumn] = useState('');
  const [currentCriterionSearchText, setCurrentCriterionSearchText] = useState('');
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileError(null);
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
          setFileError("Файл пуст или не удалось прочитать данные.");
          toast({ title: "Ошибка файла", description: "Файл пуст или не удалось прочитать данные.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        
        const paymentHeaders = Object.keys(jsonPayments[0] || {});
        setHeaders(paymentHeaders);
        setRawPayments(jsonPayments.map((p, index) => ({ ...p, __original_index__: index })));
        toast({ title: "Файл успешно загружен", description: `${jsonPayments.length} записей найдено.` });
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        setFileError("Ошибка при чтении или парсинге файла Excel. Убедитесь, что файл корректен.");
        toast({ title: "Ошибка парсинга файла", description: "Не удалось обработать файл Excel.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setFileError("Не удалось прочитать файл.");
      toast({ title: "Ошибка чтения файла", variant: "destructive" });
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleAddCriterion = () => {
    if (!currentCriterionColumn || !currentCriterionSearchText.trim()) {
      toast({ title: "Ошибка", description: "Выберите столбец и введите текст для поиска.", variant: "destructive" });
      return;
    }
    setCurrentCriteria([
      ...currentCriteria,
      { id: nanoid(), columnHeader: currentCriterionColumn, searchText: currentCriterionSearchText.trim() }
    ]);
    setCurrentCriterionColumn(headers[0] || ''); // Reset to first header or empty
    setCurrentCriterionSearchText('');
  };

  const handleRemoveCriterion = (id: string) => {
    setCurrentCriteria(currentCriteria.filter(c => c.id !== id));
  };

  const handleSaveTrigger = () => {
    if (!currentTriggerName.trim()) {
      toast({ title: "Ошибка", description: "Название триггера не может быть пустым.", variant: "destructive" });
      return;
    }
    if (currentCriteria.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы один критерий для триггера.", variant: "destructive" });
      return;
    }

    if (editingTrigger) {
      setTriggers(triggers.map(t => t.id === editingTrigger.id ? { ...editingTrigger, name: currentTriggerName.trim(), criteria: currentCriteria } : t));
      setEditingTrigger(null);
    } else {
      setTriggers([...triggers, { id: nanoid(), name: currentTriggerName.trim(), criteria: currentCriteria }]);
    }
    setCurrentTriggerName('');
    setCurrentCriteria([]);
    toast({ title: "Триггер сохранен" });
  };

  const handleEditTrigger = (trigger: Trigger) => {
    setEditingTrigger(trigger);
    setCurrentTriggerName(trigger.name);
    setCurrentCriteria([...trigger.criteria]); // Create a new array for criteria
  };
  
  const handleCancelEditTrigger = () => {
    setEditingTrigger(null);
    setCurrentTriggerName('');
    setCurrentCriteria([]);
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
      // return; // Allow processing even without triggers, will just show "not found"
    }

    setIsProcessing(true);
    const updatedPayments = rawPayments.map(payment => {
      let status = "не найден";
      let triggeredBy = "";

      for (const trigger of triggers) {
        let allCriteriaMet = trigger.criteria.length > 0; // Assume true if no criteria (should not happen with validation)
        for (const criterion of trigger.criteria) {
          const cellValue = payment[criterion.columnHeader];
          const cellValueString = String(cellValue === null || cellValue === undefined ? "" : cellValue).toLowerCase();
          const searchTextLower = criterion.searchText.toLowerCase();
          
          if (!cellValueString.includes(searchTextLower)) {
            allCriteriaMet = false;
            break; 
          }
        }
        if (allCriteriaMet) {
          status = "найден";
          triggeredBy = trigger.name;
          break; // First trigger that matches is enough
        }
      }
      return { ...payment, __trigger_status__: status, __triggered_by__: triggeredBy };
    });
    setProcessedPayments(updatedPayments);
    setIsProcessing(false);
    toast({ title: "Обработка завершена", description: "Реестр проверен на триггеры." });
  }, [rawPayments, triggers, toast]);


  const downloadExcel = () => {
    if (processedPayments.length === 0) {
      toast({ title: "Нет данных для экспорта", variant: "destructive" });
      return;
    }
    // Prepare data for export: map to original structure + new columns
    const dataToExport = processedPayments.map(p => {
        const { __trigger_status__, __triggered_by__, __original_index__, ...originalData } = p;
        return {
            ...originalData,
            "Статус Триггера": __trigger_status__ || "не найден",
            "Сработавший Триггер": __triggered_by__ || "",
        };
    });


    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Результаты проверки");
    XLSX.writeFile(workbook, `Результаты_проверки_${fileName || 'реестр'}.xlsx`);
    toast({ title: "Файл экспортирован" });
  };

  const displayHeaders = headers.length > 0 ? [...headers, "Статус Триггера", "Сработавший Триггер"] : [];
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
            Загрузите файл Excel (.xlsx, .xls) с реестром платежей.
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
          {fileError && <p className="mt-2 text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4"/> {fileError}</p>}
          {fileName && !fileError && !isLoading && <p className="mt-2 text-sm text-muted-foreground">Загружен файл: {fileName} ({rawPayments.length} строк)</p>}
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-7 w-7 text-accent" />
            2. Управление триггерами
          </CardTitle>
          <CardDescription>
            Создайте или отредактируйте триггеры для проверки. Триггер сработает, если ВСЕ его критерии будут найдены в одной строке платежа.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Card className="p-4 bg-muted/30">
                <h3 className="text-lg font-semibold mb-2">{editingTrigger ? "Редактирование триггера" : "Новый триггер"}</h3>
                <div className="space-y-3">
                    <Input 
                        placeholder="Название триггера (например, 'Платеж на большую сумму')"
                        value={currentTriggerName}
                        onChange={(e) => setCurrentTriggerName(e.target.value)}
                    />
                    <Label className="text-sm">Критерии для триггера (текст будет искаться без учета регистра):</Label>
                    <div className="pl-4 border-l-2 border-primary space-y-2">
                        {currentCriteria.map(crit => (
                            <div key={crit.id} className="flex items-center gap-2 p-2 bg-card rounded text-sm">
                                <span className="font-medium">{crit.columnHeader}:</span>
                                <span>"{crit.searchText}"</span>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveCriterion(crit.id)} className="ml-auto h-6 w-6">
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <Label htmlFor="criterion-column" className="text-xs">Столбец для поиска</Label>
                            <select 
                                id="criterion-column"
                                value={currentCriterionColumn}
                                onChange={(e) => setCurrentCriterionColumn(e.target.value)}
                                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                disabled={headers.length === 0}
                            >
                                <option value="" disabled>{headers.length > 0 ? "Выберите столбец" : "Загрузите файл для выбора столбцов"}</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="flex-grow">
                            <Label htmlFor="criterion-text" className="text-xs">Текст для поиска</Label>
                            <Input 
                                id="criterion-text"
                                placeholder="Фраза или слово"
                                value={currentCriterionSearchText}
                                onChange={(e) => setCurrentCriterionSearchText(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <Button onClick={handleAddCriterion} variant="outline" size="icon" title="Добавить критерий">
                            <PlusCircle className="h-5 w-5"/>
                        </Button>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSaveTrigger}>
                            {editingTrigger ? "Сохранить изменения" : "Добавить триггер"}
                        </Button>
                        {editingTrigger && <Button variant="ghost" onClick={handleCancelEditTrigger}>Отмена</Button>}
                    </div>
                </div>
            </Card>
            
            {triggers.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="triggers-list">
                        <AccordionTrigger className="text-lg hover:no-underline"><ListChecks className="mr-2 h-5 w-5 text-primary" />Сохраненные триггеры ({triggers.length})</AccordionTrigger>
                        <AccordionContent className="pt-2 space-y-2">
                             <ScrollArea className="h-40 pr-2">
                                {triggers.map(trigger => (
                                <Card key={trigger.id} className="p-3 mb-2">
                                    <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-md">{trigger.name}</h4>
                                        <ul className="list-disc list-inside pl-2 text-xs text-muted-foreground">
                                        {trigger.criteria.map(c => <li key={c.id}><b>{c.columnHeader}:</b> "{c.searchText}"</li>)}
                                        </ul>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditTrigger(trigger)} className="h-7 w-7" title="Редактировать">
                                            <Edit3 className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveTrigger(trigger.id)} className="h-7 w-7" title="Удалить">
                                            <Trash2 className="h-4 w-4 text-destructive"/>
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
        disabled={isLoading || isProcessing || rawPayments.length === 0} 
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
              Новые столбцы: "Статус Триггера" и "Сработавший Триггер".
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
                      <TableCell>
                        <span className={cn(
                            "font-medium px-2 py-0.5 rounded-full text-xs",
                            payment.__trigger_status__ === "найден" && "bg-green-100 text-green-800",
                            payment.__trigger_status__ === "не найден" && "bg-gray-100 text-gray-700",
                            !payment.__trigger_status__ && "bg-gray-100 text-gray-700" // Default if not processed
                        )}>
                            {payment.__trigger_status__ || (processedPayments.length > 0 ? "не найден" : "-")}
                        </span>
                      </TableCell>
                      <TableCell>{payment.__triggered_by__ || (processedPayments.length > 0 ? "" : "-")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {paymentsToDisplay.length === 0 && <p className="p-4 text-center text-muted-foreground">Нет данных для отображения. Загрузите файл и запустите проверку.</p>}
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button onClick={downloadExcel} disabled={processedPayments.length === 0} className="w-full">
              <Download className="mr-2 h-5 w-5" />
              Скачать обработанный Excel
            </Button>
          </CardFooter>
        </Card>
      )}

      <Card className="shadow-xl rounded-xl opacity-70">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-muted-foreground">
                <Info className="h-6 w-6" /> Дополнительная информация и будущие функции
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
                **Ограничение прав доступа и история предупреждений:** Эти функции (роли Администратор, Редактор, Читатель; журнал активности) являются более сложными и требуют значительной серверной инфраструктуры. На данном этапе они не реализованы.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
