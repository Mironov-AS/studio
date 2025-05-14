
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from 'react';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { generateInnovationActionPlan, type GenerateInnovationActionPlanInput, type GenerateInnovationActionPlanOutput } from "@/ai/flows/generate-innovation-action-plan-flow";
import { Loader2, Sparkles, Brain, Lightbulb, Users, BarChart, FileText, Briefcase, Target, Clock, CheckCircle, ListChecks } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const formSchema = z.object({
  ideaTitle: z.string().optional(),
  ideaDescription: z.string().min(20, { message: "Описание идеи должно содержать не менее 20 символов." }),
  proposerDepartment: z.string().optional(),
});

type InnovHubFormValues = z.infer<typeof formSchema>;

export default function InnovHubPlatform() {
  const [isLoading, setIsLoading] = useState(false);
  const [actionPlan, setActionPlan] = useState<GenerateInnovationActionPlanOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<InnovHubFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ideaTitle: "",
      ideaDescription: "",
      proposerDepartment: "",
    },
  });

  async function onSubmit(data: InnovHubFormValues) {
    setIsLoading(true);
    setActionPlan(null);
    try {
      const result = await generateInnovationActionPlan(data);
      setActionPlan(result);
      toast({
        title: "План действий для вашей идеи готов!",
        description: "AI успешно сформировал предложения.",
      });
    } catch (error) {
      console.error("Error generating innovation action plan:", error);
      toast({
        title: "Ошибка генерации",
        description: error instanceof Error ? error.message : "Не удалось получить план от AI.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-3xl font-bold">
            <Brain className="h-10 w-10 text-accent" />
            InnovHub: Центр Управления Инновациями
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Поделитесь своей идеей по улучшению бизнес-процессов или внедрению AI.
            Наша система поможет проанализировать ее и сформировать первоначальный план действий.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="ideaTitle" render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-base">Название идеи (необязательно)</FormLabel>
                      <FormControl><Input placeholder="Например, 'AI-ассистент для клиентской поддержки'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="ideaDescription" render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-base">Описание вашей идеи</FormLabel>
                      <FormControl><Textarea placeholder="Подробно опишите суть вашего предложения, какую проблему оно решает и какую пользу может принести..." {...field} rows={6} /></FormControl>
                      <FormDescription>Чем детальнее описание, тем точнее будут рекомендации AI.</FormDescription>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="proposerDepartment" render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-base">Ваш отдел (необязательно)</FormLabel>
                      <FormControl><Input placeholder="Например, 'Отдел маркетинга'" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <Button type="submit" disabled={isLoading} className="w-full text-lg py-7 rounded-lg mt-8">
                {isLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                Проанализировать идею и получить план
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 shadow-lg rounded-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="mx-auto h-16 w-16 text-primary animate-spin mb-6" />
            <p className="text-xl text-muted-foreground">AI анализирует вашу идею и формирует план действий... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {actionPlan && !isLoading && (
        <Card className="mt-8 shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl text-primary font-bold">
              <Lightbulb className="h-10 w-10" />
              Анализ и План Действий для Вашей Идеи
            </CardTitle>
            <CardDescription className="text-lg">
              AI проанализировал вашу идею "{form.getValues().ideaTitle || 'Без названия'}" и подготовил следующие предложения:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Accordion type="multiple" defaultValue={['categories', 'impact', 'roadmap', 'resources', 'timeline', 'metrics', 'docs']} className="w-full space-y-4">
              
              <AccordionItem value="categories" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Briefcase className="mr-2 h-6 w-6 text-accent" />Предлагаемые категории</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                    {actionPlan.suggestedCategories.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                            {actionPlan.suggestedCategories.map((cat, i) => <li key={i}>{cat}</li>)}
                        </ul>
                    ) : <p className="text-muted-foreground">Категории не предложены.</p>}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="impact" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Target className="mr-2 h-6 w-6 text-accent" />Потенциальное влияние</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{actionPlan.potentialImpact}</p></AccordionContent>
              </AccordionItem>

              <AccordionItem value="roadmap" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><ListChecks className="mr-2 h-6 w-6 text-accent" />Дорожная карта (шаги)</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                     {actionPlan.roadmapSteps.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-2">
                            {actionPlan.roadmapSteps.map((step, i) => <li key={i}>{step}</li>)}
                        </ol>
                    ) : <p className="text-muted-foreground">Шаги не предложены.</p>}
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="resources" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Users className="mr-2 h-6 w-6 text-accent" />Предложения по ресурсам</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                    {actionPlan.resourceSuggestions.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                            {actionPlan.resourceSuggestions.map((res, i) => <li key={i}>{res}</li>)}
                        </ul>
                    ) : <p className="text-muted-foreground">Предложения по ресурсам отсутствуют.</p>}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="timeline" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Clock className="mr-2 h-6 w-6 text-accent" />Примерные сроки</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{actionPlan.estimatedTimeline}</p></AccordionContent>
              </AccordionItem>

              <AccordionItem value="metrics" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><BarChart className="mr-2 h-6 w-6 text-accent" />Ключевые метрики успеха</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                    {actionPlan.keyMetricsForSuccess.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                            {actionPlan.keyMetricsForSuccess.map((metric, i) => <li key={i}>{metric}</li>)}
                        </ul>
                    ) : <p className="text-muted-foreground">Метрики не предложены.</p>}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="docs" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><FileText className="mr-2 h-6 w-6 text-accent" />Шаблоны документов</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                    {actionPlan.documentTemplateHints.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                            {actionPlan.documentTemplateHints.map((doc, i) => <li key={i}>{doc}</li>)}
                        </ul>
                    ) : <p className="text-muted-foreground">Подсказки по документам отсутствуют.</p>}
                </AccordionContent>
              </AccordionItem>

            </Accordion>
            <CardFooter className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                    Это предварительный анализ и план. Для детальной проработки и запуска проекта по вашей идее обратитесь к руководству вашего подразделения или в корпоративный центр инноваций.
                </p>
            </CardFooter>
          </CardContent>
        </Card>
      )}
       {/* Placeholder for future features mentioned in TZ (Kanban, voting etc.) */}
        <Card className="mt-8 shadow-lg rounded-xl opacity-60">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl text-muted-foreground">
                    <Sparkles className="h-7 w-7" /> Будущие возможности InnovHub (в разработке)
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><CheckCircle className="h-5 w-5 text-muted-foreground"/> Голосование и ранжирование идей</div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><ListChecks className="h-5 w-5 text-muted-foreground"/> Kanban-доска для управления проектами</div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><BarChart className="h-5 w-5 text-muted-foreground"/> Дашборды с аналитикой по инновациям</div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><FileText className="h-5 w-5 text-muted-foreground"/> Автоматическая генерация проектных документов</div>
            </CardContent>
        </Card>
    </div>
  );
}
