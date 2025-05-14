
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, type ChangeEvent } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { generateLeasingProposal, type GenerateLeasingProposalInput, type GenerateLeasingProposalOutput } from "@/ai/flows/generate-leasing-proposal-flow";
import { Loader2, Sparkles, Home, Briefcase, Settings, Building, Truck, MessageSquare, FileText, BarChartHorizontalBig } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const assetTypes = [
  "Недвижимость коммерческая", 
  "Недвижимость жилая (для сотрудников)", 
  "Оборудование производственное", 
  "Оборудование офисное", 
  "Транспорт"
] as const;

const formSchema = z.object({
  companyInfo: z.object({
    name: z.string().min(2, { message: "Название компании обязательно (мин. 2 символа)." }),
    inn: z.string().optional(),
    activitySphere: z.string().min(3, { message: "Сфера деятельности обязательна (мин. 3 символа)." }),
  }),
  assetRequest: z.object({
    assetType: z.enum(assetTypes, { required_error: "Выберите тип имущества." }),
    assetDetails: z.string().min(10, { message: "Описание имущества обязательно (мин. 10 символов)." }),
    estimatedCost: z.coerce.number().positive({ message: "Стоимость должна быть положительным числом." }),
  }),
  leaseParameters: z.object({
    leaseTermMonths: z.coerce.number().int().min(6, { message: "Мин. срок лизинга - 6 мес." }).max(120, { message: "Макс. срок лизинга - 120 мес." }),
    downPaymentPercentage: z.coerce.number().min(0, { message: "Первоначальный взнос не может быть отрицательным." }).max(90, { message: "Макс. первоначальный взнос - 90%." }),
  }),
  clientPriorities: z.string().optional(),
});

type LeasingFormValues = z.infer<typeof formSchema>;

export default function HomeLeasingPlatform() {
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<GenerateLeasingProposalOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<LeasingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyInfo: {
        name: "",
        inn: "",
        activitySphere: "",
      },
      assetRequest: {
        assetType: undefined,
        assetDetails: "",
        estimatedCost: undefined,
      },
      leaseParameters: {
        leaseTermMonths: 36,
        downPaymentPercentage: 20,
      },
      clientPriorities: "",
    },
  });

  async function onSubmit(data: LeasingFormValues) {
    setIsLoading(true);
    setProposal(null);
    try {
      const result = await generateLeasingProposal(data);
      setProposal(result);
      toast({
        title: "Предложение по лизингу готово!",
        description: "AI успешно сформировал для вас варианты.",
      });
    } catch (error) {
      console.error("Error generating leasing proposal:", error);
      toast({
        title: "Ошибка генерации",
        description: error instanceof Error ? error.message : "Не удалось получить предложение от AI.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const getAssetIcon = (type?: typeof assetTypes[number]) => {
    switch(type) {
        case "Недвижимость коммерческая": return <Building className="h-5 w-5 text-muted-foreground" />;
        case "Недвижимость жилая (для сотрудников)": return <Home className="h-5 w-5 text-muted-foreground" />;
        case "Оборудование производственное": return <Settings className="h-5 w-5 text-muted-foreground" />;
        case "Оборудование офисное": return <Briefcase className="h-5 w-5 text-muted-foreground" />;
        case "Транспорт": return <Truck className="h-5 w-5 text-muted-foreground" />;
        default: return <Briefcase className="h-5 w-5 text-muted-foreground" />;
    }
  }


  return (
    <div className="space-y-8">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-3xl font-bold">
            <Home className="h-10 w-10 text-accent" />
            Домашний лизинг (для корпоративных клиентов)
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            AI-платформа Банка Дом.РФ для подбора оптимальных условий лизинга недвижимости и оборудования для вашего бизнеса.
            Заполните форму ниже, чтобы получить персонализированное предложение.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              
              <Accordion type="multiple" defaultValue={['company-info', 'asset-request', 'lease-params']} className="w-full">
                <AccordionItem value="company-info" className="border-b-0">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <Briefcase className="mr-2 h-6 w-6 text-primary" /> Информация о вашей компании
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <FormField control={form.control} name="companyInfo.name" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Наименование организации</FormLabel>
                                <FormControl><Input placeholder="ООО 'Прогресс'" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="companyInfo.inn" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">ИНН (опционально)</FormLabel>
                                    <FormControl><Input placeholder="1234567890" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="companyInfo.activitySphere" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Сфера деятельности</FormLabel>
                                    <FormControl><Input placeholder="Производство, IT, Торговля" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="asset-request" className="border-b-0">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <BarChartHorizontalBig className="mr-2 h-6 w-6 text-primary" /> Запрос на лизинг
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <FormField control={form.control} name="assetRequest.assetType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Тип имущества</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Выберите тип имущества" /></SelectTrigger></FormControl>
                                    <SelectContent>{assetTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="assetRequest.assetDetails" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Описание имущества</FormLabel>
                                <FormControl><Textarea placeholder="Например: Офисное помещение, 100 кв.м, центр города, под офис продаж. Или: Станок ЧПУ XYZ-Model-500, 2023 г.в." {...field} rows={4} /></FormControl>
                                <FormDescription>Укажите ключевые характеристики и требования к имуществу.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="assetRequest.estimatedCost" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Предполагаемая стоимость (руб.)</FormLabel>
                                <FormControl><Input type="number" placeholder="5000000" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="lease-params" className="border-b-0">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                       <Settings className="mr-2 h-6 w-6 text-primary" /> Параметры лизинга
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="leaseParameters.leaseTermMonths" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Срок лизинга (месяцев)</FormLabel>
                                    <FormControl><Input type="number" placeholder="36" {...field} /></FormControl>
                                    <FormDescription>От 6 до 120 месяцев.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="leaseParameters.downPaymentPercentage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Первоначальный взнос (%)</FormLabel>
                                    <FormControl><Input type="number" placeholder="20" {...field} /></FormControl>
                                    <FormDescription>От 0 до 90%.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="clientPriorities" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Приоритеты и доп. информация (опционально)</FormLabel>
                                <FormControl><Textarea placeholder="Например: важен минимальный ежемесячный платеж, или конкретная модель оборудования..." {...field} rows={3} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-7 rounded-lg mt-8">
                {isLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                Получить предложение по лизингу
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 shadow-lg rounded-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="mx-auto h-16 w-16 text-primary animate-spin mb-6" />
            <p className="text-xl text-muted-foreground">AI анализирует ваш запрос и подбирает лучшие условия лизинга... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {proposal && !isLoading && (
        <Card className="mt-8 shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl text-primary font-bold">
              <FileText className="h-10 w-10" />
              Ваше Предложение по Лизингу от Банка Дом.РФ
            </CardTitle>
            <CardDescription className="text-lg">
              На основе предоставленных данных, наш AI-консультант подготовил следующие варианты:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Accordion type="multiple" defaultValue={proposal.suggestedOptions.map((_,i) => `option-${i}`)} className="w-full space-y-4">
              {proposal.suggestedOptions.map((opt, index) => (
                <AccordionItem key={index} value={`option-${index}`} className="border bg-card rounded-lg shadow-sm">
                  <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline">
                    <div className="flex items-center gap-2">
                      {getAssetIcon(form.getValues().assetRequest.assetType)} {opt.optionTitle}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2 space-y-3">
                    <p><strong>Описание:</strong> <span className="whitespace-pre-line text-sm text-muted-foreground">{opt.assetDescription}</span></p>
                    <p><strong>Обоснование:</strong> <span className="whitespace-pre-line text-sm text-muted-foreground">{opt.rationale}</span></p>
                    <Card className="bg-secondary/40 p-4">
                        <CardHeader className="p-0 pb-2"><CardTitle className="text-md">Предварительные условия:</CardTitle></CardHeader>
                        <CardContent className="p-0 text-sm space-y-1">
                            <p><strong>Ежемесячный платеж:</strong> {opt.preliminaryLeaseTerms.estimatedMonthlyPayment}</p>
                            <p><strong>Общая стоимость лизинга:</strong> {opt.preliminaryLeaseTerms.totalLeaseCost}</p>
                            <p><strong>Эффективная ставка:</strong> {opt.preliminaryLeaseTerms.effectiveRateApproximation}</p>
                            <p><strong>Основные условия:</strong> {opt.preliminaryLeaseTerms.mainConditions}</p>
                        </CardContent>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            <div className="space-y-4 pt-4 border-t">
                <h3 className="text-xl font-semibold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-accent" />Общие рекомендации:</h3>
                <p className="text-base whitespace-pre-line leading-relaxed text-muted-foreground">{proposal.generalRecommendations}</p>
            </div>
             <div className="space-y-4 pt-4 border-t">
                <h3 className="text-xl font-semibold flex items-center gap-2"><BarChartHorizontalBig className="h-6 w-6 text-accent" />Налоговые аспекты:</h3>
                <p className="text-base whitespace-pre-line leading-relaxed text-muted-foreground">{proposal.taxConsiderations}</p>
            </div>
            <div className="space-y-4 pt-4 border-t">
                <h3 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="h-6 w-6 text-accent" />Следующие шаги:</h3>
                <p className="text-base whitespace-pre-line leading-relaxed text-muted-foreground">{proposal.nextStepsAdvised}</p>
            </div>

            <CardFooter className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                    Это предварительные расчеты и предложения. Для получения финальных условий и оформления лизинга, пожалуйста, обратитесь к вашему персональному менеджеру в Банке Дом.РФ или следуйте указанным рекомендациям.
                </p>
            </CardFooter>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

