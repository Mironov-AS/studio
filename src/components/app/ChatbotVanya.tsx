
"use client";

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { processReminderRequest, type ProcessReminderRequestOutput } from '@/ai/flows/process-reminder-request-flow';
import { Loader2, Send, Bot, Trash2, CheckCircle, AlertTriangle, Info, MessageSquare, BellRing, CalendarCheck2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';

interface Reminder {
  id: string;
  task: string;
  dateTimeString?: string;
  recurrenceString?: string;
  originalQuery: string;
  isDone: boolean;
  timestamp: Date;
}

export default function ChatbotVanya() {
  const [userInput, setUserInput] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [reminders]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    try {
      const result: ProcessReminderRequestOutput = await processReminderRequest({ userQuery: currentInput });
      
      const newReminder: Reminder = {
        id: nanoid(),
        task: result.task,
        dateTimeString: result.dateTimeString,
        recurrenceString: result.recurrenceString,
        originalQuery: result.originalQuery,
        isDone: false,
        timestamp: new Date(),
      };

      // Simple duplicate check (very basic)
      const existingSimilar = reminders.find(r => 
        !r.isDone &&
        r.task.toLowerCase() === newReminder.task.toLowerCase() &&
        (r.dateTimeString || '').toLowerCase() === (newReminder.dateTimeString || '').toLowerCase()
      );

      if (existingSimilar) {
        toast({
          title: "Похожее напоминание уже существует",
          description: `Задача: "${existingSimilar.task}" на "${existingSimilar.dateTimeString || 'не указано'}". Добавить еще одно?`,
          action: (
            <>
              <Button onClick={() => setReminders(prev => [...prev, newReminder].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()))} size="sm">Да</Button>
            </>
          ),
          variant: "default",
          duration: 7000,
        });
      } else {
        setReminders(prev => [...prev, newReminder].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()));
        toast({ title: "Напоминание создано", description: `AI: ${result.task} (${result.dateTimeString || 'без времени'})` });
      }

    } catch (error) {
      console.error("Error processing reminder request:", error);
      toast({
        title: "Ошибка обработки запроса",
        description: error instanceof Error ? error.message : "Не удалось создать напоминание.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDone = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, isDone: !r.isDone } : r));
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    toast({ description: "Напоминание удалено." });
  };
  
  const activeReminders = reminders.filter(r => !r.isDone);
  const doneReminders = reminders.filter(r => r.isDone);

  return (
    <Card className="w-full shadow-xl rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Bot className="h-8 w-8 text-accent" /> Чат-бот Ваня: Напоминания
        </CardTitle>
        <CardDescription>
          Напишите, о чем вам напомнить. Например: "Напомни купить хлеб завтра утром" или "Позвонить клиенту в понедельник в 14:00".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80 w-full border rounded-md p-4 mb-4 bg-muted/20" ref={scrollAreaRef}>
          {reminders.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BellRing className="h-12 w-12 mb-3" />
              <p className="text-sm">Пока нет напоминаний.</p>
              <p className="text-xs">Напишите свой запрос в поле ниже.</p>
            </div>
          )}
          {activeReminders.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-primary mb-2">Активные ({activeReminders.length}):</h3>
              {activeReminders.map(reminder => (
                <Card key={reminder.id} className={cn("mb-2 p-3 shadow-sm", reminder.isDone && "opacity-60")}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={cn("font-medium", reminder.isDone && "line-through text-muted-foreground")}>{reminder.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {reminder.dateTimeString || "Время не указано"}
                        {reminder.recurrenceString && ` (${reminder.recurrenceString})`}
                      </p>
                       <p className="text-xs text-gray-400 italic mt-1">Запрос: "{reminder.originalQuery}"</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => toggleDone(reminder.id)} title={reminder.isDone ? "Вернуть в активные" : "Отметить выполненным"}>
                        <CheckCircle className={cn("h-5 w-5", reminder.isDone ? "text-green-500" : "text-gray-400 hover:text-green-500")} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteReminder(reminder.id)} title="Удалить">
                        <Trash2 className="h-5 w-5 text-destructive/70 hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {doneReminders.length > 0 && (
             <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Выполненные ({doneReminders.length}):</h3>
              {doneReminders.map(reminder => (
                 <Card key={reminder.id} className="mb-2 p-3 bg-muted/50 opacity-70 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium line-through text-muted-foreground/80">{reminder.task}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {reminder.dateTimeString || "Время не указано"}
                        {reminder.recurrenceString && ` (${reminder.recurrenceString})`}
                      </p>
                       <p className="text-xs text-gray-500 italic mt-1">Запрос: "{reminder.originalQuery}"</p>
                    </div>
                     <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => toggleDone(reminder.id)} title={reminder.isDone ? "Вернуть в активные" : "Отметить выполненным"}>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteReminder(reminder.id)} title="Удалить">
                        <Trash2 className="h-5 w-5 text-destructive/50 hover:text-destructive/70" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Что вам напомнить?"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isLoading}
            className="flex-grow"
          />
          <Button type="submit" disabled={isLoading || !userInput.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground text-center w-full">
          <Info className="inline h-3 w-3 mr-1" />
          Напоминания хранятся только в вашем браузере и будут сброшены при перезагрузке страницы.
          Это прототип для демонстрации NLP-возможностей.
        </P>
      </CardFooter>
    </Card>
  );
}
