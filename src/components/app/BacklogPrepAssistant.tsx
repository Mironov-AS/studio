
"use client";

import type { ChangeEvent } from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { analyzeBacklogCompleteness, type AnalyzeBacklogCompletenessInput, type AnalyzeBacklogCompletenessOutput, type BacklogItemData, type BacklogAnalysisResult } from '@/ai/flows/analyze-backlog-completeness-flow';
import { Loader2, FileUp, Sparkles, ListChecks, Download, Edit3, Check, XIcon, AlertTriangle, TableIcon, PlayCircle, Settings2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";
import { Form } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCEPTABLE_FILE_EXTENSIONS = ".xlsx,.xls";

// Keys for identified/suggested fields in the form data
const USER_STORY_KEY = 'Пользовательская история';
const GOAL_KEY = 'Цель';
const ACCEPTANCE_CRITERIA_KEY = 'Критерии приемки';

// Names for new columns added to display/export
const SUGGESTED_USER_STORY_COL = 'Предложенная User Story';
const SUGGESTED_GOAL_COL = 'Предложенная Цель';
const SUGGESTED_ACCEPTANCE_CRITERIA_COL = 'Предложенные Критерии Приемки';
const ANALYSIS_NOTES_COL = 'Комментарий AI';
const ACTION_COL = "AI Анализ"; // Column for analysis button

const CORE_AI_COLUMNS = [SUGGESTED_USER_STORY_COL, SUGGESTED_GOAL_COL, SUGGESTED_ACCEPTANCE_CRITERIA_COL, ANALYSIS_NOTES_COL, ACTION_COL];


const MAX_CELL_LENGTH = 32000; // Excel cell character limit is 32767

const truncateString = (str: any, maxLength: number): string => {
  const s = String(str ?? ''); // Ensure it's a string, handle null/undefined
  if (s.length > maxLength) {
    return s.substring(0, maxLength - 3) + "...";
  }
  return s;
};

// Schema for a single item in the form array
const editableBacklogItemSchema = z.object({
  id: z.string(),
  originalIndex: z.number(),
  rowData: z.record(z.string(), z.any()), // Original row data from Excel
  // Fields for AI analysis results and user edits
  [USER_STORY_KEY]: z.string().optional(), // Will hold the final editable user story
  [GOAL_KEY]: z.string().optional(),       // Will hold the final editable goal
  [ACCEPTANCE_CRITERIA_KEY]: z.string().optional(), // Will hold the final editable criteria
  _suggestedUserStory: z.string().optional(),
  _suggestedGoal: z.string().optional(),
  _suggestedAcceptanceCriteria: z.string().optional(),
  _analysisNotes: z.string().optional(),
  _analysisPerformed: z.boolean().default(false), // New flag per item
});

type EditableBacklogItem = z.infer<typeof editableBacklogItemSchema>;

const formSchema = z.object({
  backlogItems: z.array(editableBacklogItemSchema),
});
type FormValues = z.infer<typeof formSchema>;


export default function BacklogPrepAssistant() {
  const [rawExcelData, setRawExcelData] = useState<Record<string, any>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [analyzingRowId, setAnalyzingRowId] = useState<string | null>(null); // ID of the row being analyzed

  const { toast } = useToast();

  const [allToggleableColumns, setAllToggleableColumns] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (excelHeaders.length > 0) {
      const newAllToggleable = [...excelHeaders, ...CORE_AI_COLUMNS];
      setAllToggleableColumns(newAllToggleable);
      const initialVisibility: Record<string, boolean> = {};
      newAllToggleable.forEach(header => {
        initialVisibility[header] = true; // Initially all columns are visible
      });
      setColumnVisibility(initialVisibility);
    } else {
      setAllToggleableColumns([]);
      setColumnVisibility({});
    }
  }, [excelHeaders]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      backlogItems: [],
    },
  });

  const { fields, append, replace, update } = useFieldArray({
    control: form.control,
    name: "backlogItems",
  });

  const getTargetColumnName = (headers: string[], targetKeys: string[]): string | undefined => {
    for (const header of headers) {
        const lowerHeader = header.toLowerCase().trim();
        for (const key of targetKeys) {
            if (lowerHeader === key.toLowerCase().trim()) {
                return header;
            }
        }
    }
    return undefined;
  };
  
  const identifiedColumns = useMemo(() => {
    return {
        userStoryCol: getTargetColumnName(excelHeaders, [USER_STORY_KEY, 'user story', 'история пользователя']),
        goalCol: getTargetColumnName(excelHeaders, [GOAL_KEY, 'цели', 'goal']),
        acceptanceCriteriaCol: getTargetColumnName(excelHeaders, [ACCEPTANCE_CRITERIA_KEY, 'критерии приемки', 'acceptance criteria', 'критерии готовности']),
    }
  }, [excelHeaders]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    form.reset({ backlogItems: [] }); 
    setRawExcelData([]);
    setExcelHeaders([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false }); 
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "", rawNumbers: false });

        if (jsonData.length === 0) {
          toast({ title: "Файл пуст", description: "Загруженный файл не содержит данных.", variant: "destructive" });
          setIsLoadingFile(false);
          return;
        }
        
        const sanitizedJsonData = jsonData.map(row => {
          const sanitizedRow: Record<string, any> = {};
          for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
              const value = row[key];
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
                sanitizedRow[key] = value;
              } else {
                sanitizedRow[key] = String(value);
              }
            }
          }
          return sanitizedRow;
        });


        const headers = Object.keys(sanitizedJsonData[0] || {});
        setExcelHeaders(headers);
        setRawExcelData(sanitizedJsonData);

        const initialFormItems: EditableBacklogItem[] = sanitizedJsonData.map((row, index) => {
            const userStoryColName = getTargetColumnName(headers, [USER_STORY_KEY, 'user story', 'история пользователя']);
            const goalColName = getTargetColumnName(headers, [GOAL_KEY, 'цели', 'goal']);
            const acColName = getTargetColumnName(headers, [ACCEPTANCE_CRITERIA_KEY, 'критерии приемки', 'acceptance criteria', 'критерии готовности']);

            return {
                id: nanoid(),
                originalIndex: index,
                rowData: row, 
                [USER_STORY_KEY]: userStoryColName ? String(row[userStoryColName] ?? '') : '',
                [GOAL_KEY]: goalColName ? String(row[goalColName] ?? '') : '',
                [ACCEPTANCE_CRITERIA_KEY]: acColName ? String(row[acColName] ?? '') : '',
                _suggestedUserStory: '',
                _suggestedGoal: '',
                _suggestedAcceptanceCriteria: '',
                _analysisNotes: '',
                _analysisPerformed: false,
            };
        });
        replace(initialFormItems); 

        toast({ title: "Файл загружен", description: `"${file.name}" (${sanitizedJsonData.length} строк) успешно загружен.` });
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ title: "Ошибка парсинга файла", description: "Не удалось обработать файл Excel.", variant: "destructive" });
      } finally {
        setIsLoadingFile(false);
      }
    };
    reader.onerror = () => {
      toast({ title: "Ошибка чтения файла", variant: "destructive" });
      setIsLoadingFile(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleAnalyzeSingleRow = async (rowIndex: number) => {
    const formItem = fields[rowIndex];
    if (!formItem) {
      toast({ title: "Ошибка", description: "Строка для анализа не найдена.", variant: "destructive" });
      return;
    }
    setAnalyzingRowId(formItem.id);

    const itemToAnalyze: BacklogItemData = {
      id: formItem.id,
      rowData: formItem.rowData, 
    };

    try {
      const result: AnalyzeBacklogCompletenessOutput = await analyzeBacklogCompleteness({ backlogItems: [itemToAnalyze] });
      
      const aiResult = result.analyzedItems.find(ar => ar.id === formItem.id);

      if (aiResult) {
        const updatedItem: Partial<EditableBacklogItem> = {
            [USER_STORY_KEY]: (formItem[USER_STORY_KEY] || !aiResult.suggestedUserStory) ? formItem[USER_STORY_KEY] : aiResult.suggestedUserStory,
            [GOAL_KEY]: (formItem[GOAL_KEY] || !aiResult.suggestedGoal) ? formItem[GOAL_KEY] : aiResult.suggestedGoal,
            [ACCEPTANCE_CRITERIA_KEY]: (formItem[ACCEPTANCE_CRITERIA_KEY] || !aiResult.suggestedAcceptanceCriteria) ? formItem[ACCEPTANCE_CRITERIA_KEY] : aiResult.suggestedAcceptanceCriteria,
            _suggestedUserStory: aiResult.suggestedUserStory || '',
            _suggestedGoal: aiResult.suggestedGoal || '',
            _suggestedAcceptanceCriteria: aiResult.suggestedAcceptanceCriteria || '',
            _analysisNotes: aiResult.analysisNotes || '',
            _analysisPerformed: true,
        };
        update(rowIndex, { ...formItem, ...updatedItem });
        toast({ title: `Анализ строки ${formItem.originalIndex + 1} завершен`, description: "AI предоставил предложения." });
      } else {
        update(rowIndex, { ...formItem, _analysisNotes: "AI не вернул результат для этой строки.", _analysisPerformed: true });
        toast({ title: `Ошибка анализа строки ${formItem.originalIndex + 1}`, description: "AI не вернул результат.", variant: "destructive" });
      }
    } catch (error) {
      console.error(`Error analyzing row ${formItem.id}:`, error);
      update(rowIndex, { ...formItem, _analysisNotes: `Ошибка AI: ${(error as Error).message}`, _analysisPerformed: true });
      toast({ title: `Ошибка анализа строки ${formItem.originalIndex + 1}`, description: (error as Error).message, variant: "destructive" });
    } finally {
      setAnalyzingRowId(null);
    }
  };
  
  const onSubmitForm = (data: FormValues) => {
    downloadExcel(data.backlogItems);
  };

  const downloadExcel = (itemsToExport: EditableBacklogItem[]) => {
    if (itemsToExport.length === 0) {
      toast({ title: "Нет данных для экспорта", variant: "destructive" });
      return;
    }

    const dataForSheet = itemsToExport.map(item => {
      const exportRow: Record<string, any> = {};

      for (const key in item.rowData) {
        if (Object.prototype.hasOwnProperty.call(item.rowData, key)) {
          exportRow[key] = truncateString(item.rowData[key], MAX_CELL_LENGTH);
        }
      }
      
      const userStoryColKey = identifiedColumns.userStoryCol || USER_STORY_KEY;
      exportRow[userStoryColKey] = truncateString(item[USER_STORY_KEY], MAX_CELL_LENGTH);

      const goalColKey = identifiedColumns.goalCol || GOAL_KEY;
      exportRow[goalColKey] = truncateString(item[GOAL_KEY], MAX_CELL_LENGTH);
      
      const acColKey = identifiedColumns.acceptanceCriteriaCol || ACCEPTANCE_CRITERIA_KEY;
      exportRow[acColKey] = truncateString(item[ACCEPTANCE_CRITERIA_KEY], MAX_CELL_LENGTH);

      // Add AI suggestion columns if analysis was performed for this item
      if (item._analysisPerformed) {
        exportRow[SUGGESTED_USER_STORY_COL] = truncateString(item._suggestedUserStory, MAX_CELL_LENGTH);
        exportRow[SUGGESTED_GOAL_COL] = truncateString(item._suggestedGoal, MAX_CELL_LENGTH);
        exportRow[SUGGESTED_ACCEPTANCE_CRITERIA_COL] = truncateString(item._suggestedAcceptanceCriteria, MAX_CELL_LENGTH);
        exportRow[ANALYSIS_NOTES_COL] = truncateString(item._analysisNotes, MAX_CELL_LENGTH);
      }
      return exportRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Обработанный бэклог");
    
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `обработанный_бэклог_${fileName || 'export'}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Файл экспортирован", description: "Бэклог с предложениями AI сохранен. Длинные текстовые поля были автоматически сокращены при необходимости." });
  };
  
  const toggleColumnVisibility = (columnHeader: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnHeader]: !prev[columnHeader],
    }));
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileUp className="h-6 w-6 text-accent" />
            1. Загрузка Excel-файла с бэклогом
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            id="backlog-excel-upload"
            type="file"
            onChange={handleFileChange}
            accept={ACCEPTABLE_FILE_EXTENSIONS}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
            disabled={isLoadingFile || !!analyzingRowId}
          />
          {isLoadingFile && <Loader2 className="mt-2 h-5 w-5 animate-spin text-primary" />}
           {fileName && !isLoadingFile && (
            <p className="mt-2 text-sm text-muted-foreground">
              Загружен файл: {fileName} ({rawExcelData.length} строк).
              {identifiedColumns.userStoryCol && <><br/>Найдена колонка для User Story: "{identifiedColumns.userStoryCol}".</>}
              {identifiedColumns.goalCol && <><br/>Найдена колонка для Цели: "{identifiedColumns.goalCol}".</>}
              {identifiedColumns.acceptanceCriteriaCol && <><br/>Найдена колонка для Критериев Приемки: "{identifiedColumns.acceptanceCriteriaCol}".</>}
              {(!identifiedColumns.userStoryCol || !identifiedColumns.goalCol || !identifiedColumns.acceptanceCriteriaCol) && rawExcelData.length > 0 &&
                <span className="text-orange-600"><br/>Внимание: Не все целевые колонки ("{USER_STORY_KEY}", "{GOAL_KEY}", "{ACCEPTANCE_CRITERIA_KEY}") были однозначно идентифицированы. AI попытается проанализировать данные на основе всего содержимого строк.</span>
              }
            </p>
          )}
        </CardContent>
      </Card>
      
      {fields.length > 0 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitForm)}>
            <Card className="shadow-xl rounded-xl mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <ListChecks className="h-6 w-6 text-accent" />
                        2. Редактируемый бэклог с предложениями AI
                    </CardTitle>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Settings2 className="mr-2 h-4 w-4" /> Столбцы
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Отображаемые столбцы</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {allToggleableColumns.map((header) => (
                            <DropdownMenuCheckboxItem
                            key={header}
                            checked={columnVisibility[header]}
                            onCheckedChange={() => toggleColumnVisibility(header)}
                            >
                            {header}
                            </DropdownMenuCheckboxItem>
                        ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardDescription>
                  Просмотрите исходные данные. Для получения предложений AI нажмите кнопку "Анализ" в соответствующей строке. Вы можете отредактировать поля "{USER_STORY_KEY}", "{GOAL_KEY}" и "{ACCEPTANCE_CRITERIA_KEY}" перед экспортом.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {excelHeaders.map(header => 
                          columnVisibility[header] && (
                            <TableHead key={header} className={
                              [identifiedColumns.userStoryCol, identifiedColumns.goalCol, identifiedColumns.acceptanceCriteriaCol].includes(header) ? 'min-w-[250px]' : 'min-w-[150px]'
                            }>{header}</TableHead>
                          )
                        )}
                        {CORE_AI_COLUMNS.map(colName => 
                          columnVisibility[colName] && (
                            <TableHead key={colName} className='min-w-[250px]'>
                              {colName}
                            </TableHead>
                          )
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((item, index) => (
                        <TableRow key={item.id}>
                          {excelHeaders.map(header => ( 
                            columnVisibility[header] && (
                                <TableCell key={`${item.id}-${header}`} className="text-xs align-top">
                                    {header === (identifiedColumns.userStoryCol || USER_STORY_KEY) ? (
                                        <Controller name={`backlogItems.${index}.${USER_STORY_KEY}`} control={form.control} render={({ field }) => <Textarea {...field} rows={3} className="text-xs"/>} />
                                    ) : header === (identifiedColumns.goalCol || GOAL_KEY) ? (
                                        <Controller name={`backlogItems.${index}.${GOAL_KEY}`} control={form.control} render={({ field }) => <Textarea {...field} rows={2} className="text-xs"/>} />
                                    ) : header === (identifiedColumns.acceptanceCriteriaCol || ACCEPTANCE_CRITERIA_KEY) ? (
                                        <Controller name={`backlogItems.${index}.${ACCEPTANCE_CRITERIA_KEY}`} control={form.control} render={({ field }) => <Textarea {...field} rows={4} className="text-xs"/>} />
                                    ) : (
                                    String(item.rowData[header] ?? '')
                                    )}
                                </TableCell>
                            )
                          ))}
                          {/* Display AI suggestion columns */}
                          {columnVisibility[SUGGESTED_USER_STORY_COL] && (
                            <TableCell className="text-xs align-top bg-blue-50 border-l border-blue-200">
                                <Textarea value={item._suggestedUserStory || ''} readOnly rows={3} className="text-xs bg-white" placeholder={item._analysisPerformed ? "Нет предложений" : "Нажмите 'Анализ'"}/>
                            </TableCell>
                          )}
                          {columnVisibility[SUGGESTED_GOAL_COL] && (
                            <TableCell className="text-xs align-top bg-green-50 border-l border-green-200">
                                <Textarea value={item._suggestedGoal || ''} readOnly rows={2} className="text-xs bg-white" placeholder={item._analysisPerformed ? "Нет предложений" : "Нажмите 'Анализ'"}/>
                            </TableCell>
                          )}
                          {columnVisibility[SUGGESTED_ACCEPTANCE_CRITERIA_COL] && (
                            <TableCell className="text-xs align-top bg-purple-50 border-l border-purple-200">
                                <Textarea value={item._suggestedAcceptanceCriteria || ''} readOnly rows={4} className="text-xs bg-white" placeholder={item._analysisPerformed ? "Нет предложений" : "Нажмите 'Анализ'"}/>
                            </TableCell>
                          )}
                          {columnVisibility[ANALYSIS_NOTES_COL] && (
                            <TableCell className="text-xs align-top bg-gray-50 border-l border-gray-200">
                                <Textarea value={item._analysisNotes || ''} readOnly rows={2} className="text-xs bg-white" placeholder={item._analysisPerformed ? "-" : "Нажмите 'Анализ'"}/>
                            </TableCell>
                          )}
                          {columnVisibility[ACTION_COL] && (
                            <TableCell className="text-xs align-top text-center">
                                <Button 
                                    type="button" 
                                    onClick={() => handleAnalyzeSingleRow(index)} 
                                    disabled={!!analyzingRowId && analyzingRowId !== item.id} 
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                >
                                    {analyzingRowId === item.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <PlayCircle className="h-4 w-4 mr-1" />
                                    )}
                                    Анализ
                                </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                 <CardDescription className="mt-2 text-xs">
                    Колонки "{USER_STORY_KEY}", "{GOAL_KEY}", "{ACCEPTANCE_CRITERIA_KEY}" являются редактируемыми.
                    Колонки с префиксом "Предложенн(ая/ые)" содержат предложения AI и не редактируются напрямую.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={!!analyzingRowId || isLoadingFile}>
                  <Download className="mr-2 h-4 w-4" /> Экспортировать обновленный бэклог в Excel
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      )}
       {rawExcelData.length > 0 && fields.length === 0 && !isLoadingFile && (
         <Card className="mt-4 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-orange-500 mb-3" />
            <p className="text-md text-muted-foreground">Данные из файла загружены, но таблица бэклога не отображается. Пожалуйста, перезагрузите страницу или попробуйте загрузить файл заново.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

