
"use client";

import type { ChangeEvent } from 'react';
import { useState, useCallback, useMemo } from 'react';
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
import { Loader2, FileUp, Sparkles, ListChecks, Download, Edit3, Check, XIcon, AlertTriangle, TableIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";
import { Form } from "@/components/ui/form"; 

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


// Schema for a single item in the form array
const editableBacklogItemSchema = z.object({
  id: z.string(),
  originalIndex: z.number(),
  rowData: z.record(z.string(), z.any()), // Original row data from Excel
  // Fields for AI analysis results and user edits
  [USER_STORY_KEY]: z.string().optional(), // Will hold the final editable user story
  [GOAL_KEY]: z.string().optional(),       // Will hold the final editable goal
  [ACCEPTANCE_CRITERIA_KEY]: z.string().optional(), // Will hold the final editable criteria
  // Store suggestions separately for display, not directly part of the main editable fields
  _suggestedUserStory: z.string().optional(),
  _suggestedGoal: z.string().optional(),
  _suggestedAcceptanceCriteria: z.string().optional(),
  _analysisNotes: z.string().optional(),
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPerformed, setAnalysisPerformed] = useState(false);

  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      backlogItems: [],
    },
  });

  const { fields, append, replace } = useFieldArray({
    control: form.control,
    name: "backlogItems",
  });

  // Helper to identify target columns - case-insensitive and common variations
  const getTargetColumnName = (headers: string[], targetKeys: string[]): string | undefined => {
    for (const header of headers) {
        const lowerHeader = header.toLowerCase().trim();
        for (const key of targetKeys) {
            if (lowerHeader === key.toLowerCase().trim()) {
                return header; // Return original header name
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
    setAnalysisPerformed(false);
    form.reset({ backlogItems: [] }); // Clear previous results
    setRawExcelData([]);
    setExcelHeaders([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Set cellDates to false to prevent Date objects
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false }); 
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          toast({ title: "Файл пуст", description: "Загруженный файл не содержит данных.", variant: "destructive" });
          setIsLoadingFile(false);
          return;
        }
        
        // Sanitize jsonData to ensure all cell values are primitives
        const sanitizedJsonData = jsonData.map(row => {
          const sanitizedRow: Record<string, any> = {};
          for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
              const value = row[key];
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
                sanitizedRow[key] = value;
              } else {
                // Convert any other type (e.g., special error objects from xlsx) to string
                sanitizedRow[key] = String(value);
              }
            }
          }
          return sanitizedRow;
        });


        const headers = Object.keys(sanitizedJsonData[0] || {});
        setExcelHeaders(headers);
        setRawExcelData(sanitizedJsonData);

        // Initialize form with sanitized data
        const initialFormItems: EditableBacklogItem[] = sanitizedJsonData.map((row, index) => {
            const userStoryColName = getTargetColumnName(headers, [USER_STORY_KEY, 'user story', 'история пользователя']);
            const goalColName = getTargetColumnName(headers, [GOAL_KEY, 'цели', 'goal']);
            const acColName = getTargetColumnName(headers, [ACCEPTANCE_CRITERIA_KEY, 'критерии приемки', 'acceptance criteria', 'критерии готовности']);

            return {
                id: nanoid(),
                originalIndex: index,
                rowData: row, // rowData is now sanitized
                [USER_STORY_KEY]: userStoryColName ? String(row[userStoryColName] ?? '') : '',
                [GOAL_KEY]: goalColName ? String(row[goalColName] ?? '') : '',
                [ACCEPTANCE_CRITERIA_KEY]: acColName ? String(row[acColName] ?? '') : '',
                _suggestedUserStory: '',
                _suggestedGoal: '',
                _suggestedAcceptanceCriteria: '',
                _analysisNotes: '',
            };
        });
        replace(initialFormItems); // Use replace to set the whole array

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

  const handleAnalyzeBacklog = async () => {
    if (rawExcelData.length === 0) {
      toast({ title: "Нет данных", description: "Сначала загрузите файл Excel с бэклогом.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    setAnalysisPerformed(false);

    const itemsToAnalyze: BacklogItemData[] = rawExcelData.map((row, index) => ({
      id: fields[index]?.id || nanoid(), // Use existing ID if available, or generate new
      rowData: row, // rowData is already sanitized here
    }));

    try {
      const result: AnalyzeBacklogCompletenessOutput = await analyzeBacklogCompleteness({ backlogItems: itemsToAnalyze });
      
      // Merge AI results with existing form data
      const updatedFormItems = fields.map(formItem => {
        const aiResult = result.analyzedItems.find(ar => ar.id === formItem.id);
        if (aiResult) {
          return {
            ...formItem,
            // If original was empty and AI suggested something, pre-fill the editable field with suggestion
            [USER_STORY_KEY]: (formItem[USER_STORY_KEY] || !aiResult.suggestedUserStory) ? formItem[USER_STORY_KEY] : aiResult.suggestedUserStory,
            [GOAL_KEY]: (formItem[GOAL_KEY] || !aiResult.suggestedGoal) ? formItem[GOAL_KEY] : aiResult.suggestedGoal,
            [ACCEPTANCE_CRITERIA_KEY]: (formItem[ACCEPTANCE_CRITERIA_KEY] || !aiResult.suggestedAcceptanceCriteria) ? formItem[ACCEPTANCE_CRITERIA_KEY] : aiResult.suggestedAcceptanceCriteria,
            // Store suggestions separately for display
            _suggestedUserStory: aiResult.suggestedUserStory || '',
            _suggestedGoal: aiResult.suggestedGoal || '',
            _suggestedAcceptanceCriteria: aiResult.suggestedAcceptanceCriteria || '',
            _analysisNotes: aiResult.analysisNotes || '',
          };
        }
        return formItem;
      });
      replace(updatedFormItems);
      setAnalysisPerformed(true);
      toast({ title: "Анализ завершен", description: "AI проверил бэклог и предоставил предложения." });
    } catch (error) {
      console.error("Error analyzing backlog:", error);
      toast({ title: "Ошибка анализа", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const onSubmitForm = (data: FormValues) => {
    // This function is called when the form is submitted, typically for saving changes.
    // For now, we'll just log the data. Export will handle current form state.
    console.log("Form submitted (for export):", data);
    downloadExcel(data.backlogItems);
  };

  const downloadExcel = (itemsToExport: EditableBacklogItem[]) => {
    if (itemsToExport.length === 0) {
      toast({ title: "Нет данных для экспорта", variant: "destructive" });
      return;
    }

    // Prepare data for export
    const dataForSheet = itemsToExport.map(item => {
      const exportRow: Record<string, any> = { ...item.rowData }; // Start with original data
      
      // Update/add target columns from form state
      if (identifiedColumns.userStoryCol) exportRow[identifiedColumns.userStoryCol] = item[USER_STORY_KEY];
      else if(item[USER_STORY_KEY]) exportRow[USER_STORY_KEY] = item[USER_STORY_KEY]; // Add as new if not exists

      if (identifiedColumns.goalCol) exportRow[identifiedColumns.goalCol] = item[GOAL_KEY];
      else if(item[GOAL_KEY]) exportRow[GOAL_KEY] = item[GOAL_KEY];

      if (identifiedColumns.acceptanceCriteriaCol) exportRow[identifiedColumns.acceptanceCriteriaCol] = item[ACCEPTANCE_CRITERIA_KEY];
      else if(item[ACCEPTANCE_CRITERIA_KEY]) exportRow[ACCEPTANCE_CRITERIA_KEY] = item[ACCEPTANCE_CRITERIA_KEY];

      // Add AI suggestion columns if analysis was performed
      if (analysisPerformed) {
        exportRow[SUGGESTED_USER_STORY_COL] = item._suggestedUserStory || '';
        exportRow[SUGGESTED_GOAL_COL] = item._suggestedGoal || '';
        exportRow[SUGGESTED_ACCEPTANCE_CRITERIA_COL] = item._suggestedAcceptanceCriteria || '';
        exportRow[ANALYSIS_NOTES_COL] = item._analysisNotes || '';
      }
      // Remove internal fields before export
      const {_suggestedUserStory, _suggestedGoal, _suggestedAcceptanceCriteria, _analysisNotes, id, originalIndex, rowData, ...restOfItem} = item;
      return exportRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Обработанный бэклог");
    
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    // Use correct MIME type for XLSX and do NOT prepend BOM for binary XLSX files.
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `обработанный_бэклог_${fileName || 'export'}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Файл экспортирован", description: "Бэклог с предложениями AI сохранен." });
  };
  
  const displayTableHeaders = useMemo(() => {
    let currentHeaders = [...excelHeaders];
    if (analysisPerformed) {
        if (!currentHeaders.includes(SUGGESTED_USER_STORY_COL)) currentHeaders.push(SUGGESTED_USER_STORY_COL);
        if (!currentHeaders.includes(SUGGESTED_GOAL_COL)) currentHeaders.push(SUGGESTED_GOAL_COL);
        if (!currentHeaders.includes(SUGGESTED_ACCEPTANCE_CRITERIA_COL)) currentHeaders.push(SUGGESTED_ACCEPTANCE_CRITERIA_COL);
        if (!currentHeaders.includes(ANALYSIS_NOTES_COL)) currentHeaders.push(ANALYSIS_NOTES_COL);
    }
    return currentHeaders;
  }, [excelHeaders, analysisPerformed]);


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
            disabled={isLoadingFile || isAnalyzing}
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

      <Button
        onClick={handleAnalyzeBacklog}
        disabled={isLoadingFile || isAnalyzing || rawExcelData.length === 0}
        className="w-full text-lg py-4 rounded-lg"
      >
        {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
        2. Проанализировать бэклог и получить предложения AI
      </Button>
      
      {isAnalyzing && fields.length === 0 && (
         <Card className="mt-4 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-md text-muted-foreground">AI анализирует ваш бэклог... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {fields.length > 0 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitForm)}>
            <Card className="shadow-xl rounded-xl mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-xl">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-6 w-6 text-accent" />
                    3. Редактируемый бэклог с предложениями AI
                  </div>
                </CardTitle>
                <CardDescription>
                  Просмотрите исходные данные и предложения AI. Вы можете отредактировать поля "{USER_STORY_KEY}", "{GOAL_KEY}" и "{ACCEPTANCE_CRITERIA_KEY}" перед экспортом.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {displayTableHeaders.map(header => (
                          <TableHead key={header} className={
                            [USER_STORY_KEY, GOAL_KEY, ACCEPTANCE_CRITERIA_KEY, SUGGESTED_USER_STORY_COL, SUGGESTED_GOAL_COL, SUGGESTED_ACCEPTANCE_CRITERIA_COL, ANALYSIS_NOTES_COL].includes(header) ? 'min-w-[250px]' : 'min-w-[150px]'
                          }>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((item, index) => (
                        <TableRow key={item.id}>
                          {excelHeaders.map(header => (
                            <TableCell key={`${item.id}-${header}`} className="text-xs align-top">
                                {header === identifiedColumns.userStoryCol || (header === USER_STORY_KEY && !identifiedColumns.userStoryCol) ? (
                                    <Controller name={`backlogItems.${index}.${USER_STORY_KEY}`} control={form.control} render={({ field }) => <Textarea {...field} rows={3} className="text-xs"/>} />
                                ) : header === identifiedColumns.goalCol || (header === GOAL_KEY && !identifiedColumns.goalCol) ? (
                                    <Controller name={`backlogItems.${index}.${GOAL_KEY}`} control={form.control} render={({ field }) => <Textarea {...field} rows={2} className="text-xs"/>} />
                                ) : header === identifiedColumns.acceptanceCriteriaCol || (header === ACCEPTANCE_CRITERIA_KEY && !identifiedColumns.acceptanceCriteriaCol) ? (
                                    <Controller name={`backlogItems.${index}.${ACCEPTANCE_CRITERIA_KEY}`} control={form.control} render={({ field }) => <Textarea {...field} rows={4} className="text-xs"/>} />
                                ) : (
                                   String(item.rowData[header] ?? '')
                                )}
                            </TableCell>
                          ))}
                          {/* Display AI suggestion columns if analysis has been performed */}
                          {analysisPerformed && (
                            <>
                              <TableCell className="text-xs align-top bg-blue-50 border-l border-blue-200">
                                <Textarea value={item._suggestedUserStory || ''} readOnly rows={3} className="text-xs bg-white" placeholder="Нет предложений"/>
                              </TableCell>
                              <TableCell className="text-xs align-top bg-green-50 border-l border-green-200">
                                 <Textarea value={item._suggestedGoal || ''} readOnly rows={2} className="text-xs bg-white" placeholder="Нет предложений"/>
                              </TableCell>
                              <TableCell className="text-xs align-top bg-purple-50 border-l border-purple-200">
                                <Textarea value={item._suggestedAcceptanceCriteria || ''} readOnly rows={4} className="text-xs bg-white" placeholder="Нет предложений"/>
                              </TableCell>
                              <TableCell className="text-xs align-top bg-gray-50 border-l border-gray-200">
                                <Textarea value={item._analysisNotes || ''} readOnly rows={2} className="text-xs bg-white"/>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                 <CardDescription className="mt-2 text-xs">
                    Колонки "{USER_STORY_KEY}", "{GOAL_KEY}", "{ACCEPTANCE_CRITERIA_KEY}" являются редактируемыми.
                    {analysisPerformed && ` Колонки "${SUGGESTED_USER_STORY_COL}", "${SUGGESTED_GOAL_COL}", "${SUGGESTED_ACCEPTANCE_CRITERIA_COL}" содержат предложения AI и не редактируются напрямую.`}
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isAnalyzing || isLoadingFile}>
                  <Download className="mr-2 h-4 w-4" /> Экспортировать обновленный бэклог в Excel
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      )}
       {rawExcelData.length > 0 && fields.length === 0 && !isAnalyzing && !isLoadingFile && (
         <Card className="mt-4 shadow-lg rounded-xl">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-orange-500 mb-3" />
            <p className="text-md text-muted-foreground">Бэклог не был проанализирован. Нажмите кнопку "Проанализировать бэклог".</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    
