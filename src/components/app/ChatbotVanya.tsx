
"use client";

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { processReminderRequest, type ProcessReminderRequestOutput } from '@/ai/flows/process-reminder-request-flow';
import { Loader2, Send, Bot, Trash2, CheckCircle, AlertTriangle, Info, MessageSquare, BellRing, CalendarCheck2, BellDot } from 'lucide-react';
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
  notificationTimeoutId?: NodeJS.Timeout;
}

// Basic date/time parsing
// Returns a Date object if successful, or null
// This is a VERY simplified parser for demonstration.
function parseDateTimeStringForNotification(dateTimeString?: string): Date | null {
  if (!dateTimeString) return null;

  const now = new Date();
  let reminderDate = new Date();
  let timeSet = false;

  const timeMatch = dateTimeString.match(/(\d{1,2})[:\.](\d{2})/); // Matches HH:MM or H.MM etc.
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      reminderDate.setHours(hours, minutes, 0, 0);
      timeSet = true;
    }
  }

  if (dateTimeString.toLowerCase().includes("завтра")) {
    reminderDate.setDate(now.getDate() + 1);
  } else if (!dateTimeString.toLowerCase().includes("сегодня") && timeSet && reminderDate < now) {
    // If time is set and it's in the past for today, assume tomorrow (unless "сегодня" was specified)
    reminderDate.setDate(now.getDate() + 1);
  }
  
  // If no specific time was parsed, but "утром", "днем", "вечером" mentioned.
  if (!timeSet) {
    if (dateTimeString.toLowerCase().includes("утром")) reminderDate.setHours(9,0,0,0);
    else if (dateTimeString.toLowerCase().includes("днем")) reminderDate.setHours(14,0,0,0);
    else if (dateTimeString.toLowerCase().includes("вечером")) reminderDate.setHours(19,0,0,0);
    else return null; // Cannot parse a specific time
  }

  // If the final parsed date is in the past, return null (don't schedule for past)
  if (reminderDate < new Date()) {
    return null;
  }

  return reminderDate;
}


export default function ChatbotVanya() {
  const [userInput, setUserInput] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast({ title: "Уведомления не поддерживаются", description: "Ваш браузер не поддерживает системные уведомления.", variant: "destructive" });
      return 'denied';
    }
    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      return 'granted';
    }
    if (Notification.permission === 'denied') {
      toast({ title: "Уведомления заблокированы", description: "Пожалуйста, разрешите уведомления в настройках вашего браузера для этого сайта.", variant: "default" });
      setNotificationPermission('denied');
      return 'denied';
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast({ title: "Уведомления разрешены!", description: "Теперь вы будете получать напоминания." });
    } else {
      toast({ title: "Уведомления не разрешены", description: "Вы не будете получать системные напоминания." });
    }
    return permission;
  };
  
  const scheduleNotification = (reminder: Omit<Reminder, 'id' | 'isDone' | 'timestamp' | 'notificationTimeoutId'> & { id: string }) => {
    if (notificationPermission !== 'granted') {
      console.log("Notification permission not granted, skipping schedule for:", reminder.task);
      return undefined;
    }

    const reminderDateTime = parseDateTimeStringForNotification(reminder.dateTimeString);
    if (!reminderDateTime) {
      console.log("Could not parse date/time for notification:", reminder.task, reminder.dateTimeString);
      return undefined;
    }

    const delay = reminderDateTime.getTime() - new Date().getTime();
    if (delay <= 0) {
      console.log("Reminder time is in the past, not scheduling:", reminder.task);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      new Notification("Напоминание от Вани!", {
        body: reminder.task,
        icon: '/favicon.ico', // Optional: add an icon
      });
      // Remove timeoutId from reminder once notification fires
      setReminders(prev => prev.map(r => r.id === reminder.id ? {...r, notificationTimeoutId: undefined} : r));
    }, delay);
    
    toast({ description: `Системное уведомление для "${reminder.task}" запланировано на ${reminderDateTime.toLocaleString('ru-RU')}.`, duration: 3000 });
    return timeoutId;
  };

  const cancelNotification = (timeoutId?: NodeJS.Timeout) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };


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

    // Request permission if not already granted and a time might be involved
    let currentPermission = notificationPermission;
    if (currentPermission === 'default' && currentInput.match(/\d{1,2}[:\.]\d{2}|утр|днем|вечер|завтра|сегодня/i)) {
        currentPermission = await requestNotificationPermission();
    }

    try {
      const result: ProcessReminderRequestOutput = await processReminderRequest({ userQuery: currentInput });
      
      const reminderBase = {
        task: result.task,
        dateTimeString: result.dateTimeString,
        recurrenceString: result.recurrenceString,
        originalQuery: result.originalQuery,
      };
      
      const newReminderId = nanoid();
      let notificationTimeoutId: NodeJS.Timeout | undefined = undefined;

      if (currentPermission === 'granted') {
        notificationTimeoutId = scheduleNotification({ ...reminderBase, id: newReminderId });
      }
      
      const newReminder: Reminder = {
        ...reminderBase,
        id: newReminderId,
        isDone: false,
        timestamp: new Date(),
        notificationTimeoutId,
      };

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
              <Button onClick={() => setReminders(prev => [...prev, newReminder].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()))} size="sm">Да</Button>
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
    setReminders(prev => prev.map(r => {
      if (r.id === id) {
        if (!r.isDone && r.notificationTimeoutId) { // If marking as done and notification exists
          cancelNotification(r.notificationTimeoutId);
          toast({ description: `Системное уведомление для "${r.task}" отменено.`});
          return { ...r, isDone: !r.isDone, notificationTimeoutId: undefined };
        }
        // If re-activating, re-schedule notification if possible (basic re-schedule, might need adjustment for past times)
        if (r.isDone && !r.notificationTimeoutId && notificationPermission === 'granted') {
            const newTimeoutId = scheduleNotification(r);
            return { ...r, isDone: !r.isDone, notificationTimeoutId: newTimeoutId };
        }
        return { ...r, isDone: !r.isDone };
      }
      return r;
    }));
  };

  const deleteReminder = (id: string) => {
    const reminderToDelete = reminders.find(r => r.id === id);
    if (reminderToDelete?.notificationTimeoutId) {
      cancelNotification(reminderToDelete.notificationTimeoutId);
      toast({ description: `Системное уведомление для "${reminderToDelete.task}" отменено.`});
    }
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
          При указании времени система попытается показать всплывающее уведомление.
        </CardDescription>
        {typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'default' && (
             <Button onClick={requestNotificationPermission} variant="outline" size="sm" className="mt-2">
                <BellDot className="mr-2 h-4 w-4"/> Запросить разрешение на уведомления
            </Button>
        )}
         {notificationPermission === 'denied' && (
            <p className="text-xs text-destructive mt-1">Уведомления заблокированы. Разрешите их в настройках браузера.</p>
        )}
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
                        {reminder.notificationTimeoutId && <BellDot className="inline h-3 w-3 ml-1 text-accent" title="Системное уведомление запланировано"/>}
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
          Напоминания и их системные уведомления хранятся только в вашем браузере и будут сброшены при перезагрузке страницы/закрытии браузера.
        </p>
      </CardFooter>
    </Card>
  );
}
