
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { generateCorporateRealEstateAdvice, type GenerateCorporateRealEstateAdviceInput, type GenerateCorporateRealEstateAdviceOutput } from "@/ai/flows/generate-corporate-real-estate-advice-flow";
import { Loader2, Sparkles, Building2, Briefcase, DollarSign, BarChart, Map, MessageSquare, FileText, Users, ShieldAlert, Handshake, TrendingUp, Lightbulb, HandCoins } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const corporatePropertyTypes = [
  { id: "offices", label: "Офисные помещения" },
  { id: "warehouses", label: "Складские комплексы" },
  { id: "retail", label: "Торговые площади" },
  { id: "industrial", label: "Производственные помещения" },
  { id: "land_commercial", label: "Земельные участки (коммерческие)" },
  { id: "multifunctional", label: "Многофункциональные комплексы" },
  { id: "hospitality", label: "Гостиничная недвижимость" },
  { id: "other", label: "Другое" },
] as const;

const corporateInvestmentObjectives = [
  { id: "own_use", label: "Для собственных нужд (офис, производство, склад)" },
  { id: "rental_investment", label: "Инвестиции для сдачи в аренду" },
  { id: "resale_investment", label: "Инвестиции для перепродажи (рост капитала)" },
  { id: "asset_diversification", label: "Диверсификация активов" },
  { id: "collateral_fund", label: "Формирование залогового фонда" },
  { id: "strategic_development", label: "Стратегическое развитие (выход на новые рынки)" },
] as const;

const budgetRanges = ['до 50 млн руб', '50-200 млн руб', '200-500 млн руб', 'свыше 500 млн руб', 'Индивидуально'] as const;
const corporateInvestmentHorizons = ['Краткосрочный (до 3 лет)', 'Среднесрочный (3-7 лет)', 'Долгосрочный (более 7 лет)'] as const;
const corporateRiskAppetites = ['Консервативный', 'Умеренный', 'Высокий'] as const;

const formSchema = z.object({
  companyName: z.string().min(2, { message: "Наименование компании обязательно (мин. 2 символа)." }),
  industry: z.string().min(3, { message: "Укажите отрасль (мин. 3 символа)." }),
  companyProfile: z.string().min(20, { message: "Опишите профиль компании (мин. 20 символов)." }),
  expansionStrategy: z.string().optional(),
  regionsOfInterest: z.string().min(3, { message: "Укажите регионы интереса (мин. 3 символа)." }),
  preferredPropertyTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "Выберите хотя бы один тип недвижимости.",
  }),
  investmentObjectives: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "Выберите хотя бы одну инвестиционную цель.",
  }),
  budgetRange: z.enum(budgetRanges, { required_error: "Выберите бюджет." }),
  investmentHorizon: z.enum(corporateInvestmentHorizons, { required_error: "Выберите срок инвестиций." }),
  riskAppetite: z.enum(corporateRiskAppetites, { required_error: "Выберите уровень риска." }),
  additionalRequirements: z.string().optional(),
});

type CorporateRoboAdvisorFormValues = z.infer<typeof formSchema>;

export default function CorporateRoboAdvisor() {
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState<GenerateCorporateRealEstateAdviceOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<CorporateRoboAdvisorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      industry: "",
      companyProfile: "",
      expansionStrategy: "",
      regionsOfInterest: "",
      preferredPropertyTypes: [],
      investmentObjectives: [],
      budgetRange: undefined,
      investmentHorizon: undefined,
      riskAppetite: undefined,
      additionalRequirements: "",
    },
  });

  async function onSubmit(data: CorporateRoboAdvisorFormValues) {
    setIsLoading(true);
    setAdvice(null);
    try {
      // Map form labels to enum values expected by the flow if they differ
      // For this setup, labels are directly used as values, which is fine if consistent.
      const inputData: GenerateCorporateRealEstateAdviceInput = {
        ...data,
        // Ensure array fields are correctly typed if schema expects specific enums
        preferredPropertyTypes: data.preferredPropertyTypes as any, // Cast if flow expects stricter enum types
        investmentObjectives: data.investmentObjectives as any, // Cast if flow expects stricter enum types
      };
      const result = await generateCorporateRealEstateAdvice(inputData);
      setAdvice(result);
      toast({
        title: "Инвестиционный план для вашей компании готов!",
        description: "AI успешно сформировал рекомендации.",
      });
    } catch (error) {
      console.error("Error generating corporate real estate advice:", error);
      toast({
        title: "Ошибка генерации",
        description: error instanceof Error ? error.message : "Не удалось получить рекомендации от AI.",
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
            <Building2 className="h-10 w-10 text-accent" />
            Корпоративный Робоэдвайзер по Недвижимости
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Сервис Банка Дом.РФ для формирования стратегических инвестиционных планов в коммерческую недвижимость.
            Заполните информацию о вашей компании для получения персонализированных рекомендаций.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              
              <Accordion type="multiple" defaultValue={['company-info', 'property-preferences']} className="w-full">
                <AccordionItem value="company-info" className="border-b-0">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <Briefcase className="mr-2 h-6 w-6 text-primary" /> Информация о компании
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="companyName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Наименование компании</FormLabel>
                                    <FormControl><Input placeholder="ООО 'Инновации Плюс'" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="industry" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Отрасль</FormLabel>
                                    <FormControl><Input placeholder="IT, Производство, Ритейл" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="companyProfile" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Профиль компании</FormLabel>
                                <FormControl><Textarea placeholder="Краткое описание, финансовое положение, активы, обязательства..." {...field} rows={4} /></FormControl>
                                <FormDescription>Чем подробнее описание, тем точнее будут рекомендации.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="expansionStrategy" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Стратегия расширения/диверсификации (если есть)</FormLabel>
                                <FormControl><Textarea placeholder="Планы по выходу на новые рынки, диверсификация продуктовой линейки..." {...field} rows={3} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="property-preferences" className="border-b-0">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <Map className="mr-2 h-6 w-6 text-primary" /> Предпочтения по недвижимости и инвестициям
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <FormField control={form.control} name="regionsOfInterest" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Регионы интереса</FormLabel>
                                <FormControl><Input placeholder="Москва, Санкт-Петербург, промышленные зоны Урала" {...field} /></FormControl>
                                <FormDescription>Укажите города или регионы для инвестиций/размещения.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="budgetRange" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Бюджет/диапазон инвестиций</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Выберите бюджет" /></SelectTrigger></FormControl>
                                        <SelectContent>{budgetRanges.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="investmentHorizon" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base">Срок инвестиций/использования</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Выберите срок" /></SelectTrigger></FormControl>
                                        <SelectContent>{corporateInvestmentHorizons.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="riskAppetite" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Уровень допустимого риска</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Выберите уровень риска" /></SelectTrigger></FormControl>
                                    <SelectContent>{corporateRiskAppetites.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="preferredPropertyTypes" render={() => (
                            <FormItem>
                                <FormLabel className="text-base">Предпочтительные типы коммерческой недвижимости</FormLabel>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 pt-2">
                                    {corporatePropertyTypes.map((item) => (<FormField key={item.id} control={form.control} name="preferredPropertyTypes" render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl><Checkbox checked={field.value?.includes(item.label)} onCheckedChange={(checked) => {
                                                return checked ? field.onChange([...(field.value || []), item.label]) : field.onChange((field.value || []).filter(v => v !== item.label));
                                            }} /></FormControl>
                                            <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                                        </FormItem>
                                    )} />))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="investmentObjectives" render={() => (
                            <FormItem>
                                <FormLabel className="text-base">Инвестиционные или бизнес-цели</FormLabel>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 pt-2">
                                    {corporateInvestmentObjectives.map((item) => (<FormField key={item.id} control={form.control} name="investmentObjectives" render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl><Checkbox checked={field.value?.includes(item.label)} onCheckedChange={(checked) => {
                                                return checked ? field.onChange([...(field.value || []), item.label]) : field.onChange((field.value || []).filter(v => v !== item.label));
                                            }} /></FormControl>
                                            <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                                        </FormItem>
                                    )} />))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="additionalRequirements" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base">Дополнительные требования/комментарии</FormLabel>
                                <FormControl><Textarea placeholder="Например, необходимость ж/д ветки, высокие потолки, близость к логистическим хабам..." {...field} rows={3} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-7 rounded-lg mt-8">
                {isLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                Получить стратегический план
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 shadow-lg rounded-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="mx-auto h-16 w-16 text-primary animate-spin mb-6" />
            <p className="text-xl text-muted-foreground">AI анализирует данные и формирует стратегический план для вашей компании... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {advice && !isLoading && (
        <Card className="mt-8 shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl text-primary font-bold">
              <TrendingUp className="h-10 w-10" />
              Стратегический План по Недвижимости для "{form.getValues().companyName}"
            </CardTitle>
            <CardDescription className="text-lg">
              На основе предоставленных вами данных, наш AI-консультант подготовил следующие рекомендации:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Accordion type="multiple" defaultValue={['strategy', 'properties', 'market', 'profitability', 'next_steps']} className="w-full space-y-4">
              
              <AccordionItem value="strategy" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><FileText className="mr-2 h-6 w-6 text-accent" />Общая стратегия</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{advice.overallStrategyRecommendation}</p></AccordionContent>
              </AccordionItem>

              <AccordionItem value="properties" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Map className="mr-2 h-6 w-6 text-accent" />Предлагаемые объекты/локации</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                  {advice.suggestedProperties.map((prop, index) => (
                    <Card key={index} className="bg-secondary/40 shadow-inner rounded-md">
                      <CardHeader>
                        <CardTitle className="text-lg text-primary-foreground flex items-center gap-2"><Building2 className="h-5 w-5"/>{prop.type}</CardTitle>
                        <CardDescription className="text-sm"><strong>Критерии локации:</strong> {prop.locationCriteria}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p><strong>Обоснование для бизнеса:</strong> <span className="whitespace-pre-line">{prop.rationaleForBusiness}</span></p>
                        <p><strong>Примерный бюджет:</strong> {prop.estimatedBudgetCategory}</p>
                        <p><strong>Ключевые преимущества:</strong> {prop.keyBenefits}</p>
                        <p><strong>Потенциальные риски:</strong> {prop.potentialRisks}</p>
                      </CardContent>
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="market" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><BarChart className="mr-2 h-6 w-6 text-accent" />Обзор рынка</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{advice.marketSegmentOutlook}</p></AccordionContent>
              </AccordionItem>

              <AccordionItem value="profitability" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><DollarSign className="mr-2 h-6 w-6 text-accent" />Анализ доходности</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{advice.profitabilityConsiderations}</p></AccordionContent>
              </AccordionItem>

              {advice.portfolioManagementNotes && (
                <AccordionItem value="portfolio" className="border bg-card rounded-lg shadow-sm">
                  <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Briefcase className="mr-2 h-6 w-6 text-accent" />Управление портфелем</AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{advice.portfolioManagementNotes}</p></AccordionContent>
                </AccordionItem>
              )}

              {advice.financingAndCollateralRemarks && (
                 <AccordionItem value="financing" className="border bg-card rounded-lg shadow-sm">
                  <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><Handshake className="mr-2 h-6 w-6 text-accent" />Финансирование и залог</AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{advice.financingAndCollateralRemarks}</p></AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="next_steps" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline"><HandCoins className="mr-2 h-6 w-6 text-accent" />Следующие шаги</AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base"><p className="whitespace-pre-line leading-relaxed">{advice.recommendedNextSteps}</p></AccordionContent>
              </AccordionItem>
            </Accordion>
            <CardFooter className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                    Это предварительные рекомендации. Для получения детальной консультации и помощи в реализации инвестиционной стратегии, пожалуйста, обратитесь к вашему персональному менеджеру в Банке Дом.РФ.
                </p>
            </CardFooter>
          </CardContent>
        </Card>
      )}

        {/* Placeholder for future features mentioned in TZ */}
        <Card className="mt-8 shadow-lg rounded-xl opacity-60">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl text-muted-foreground">
                    <Lightbulb className="h-7 w-7" /> Дополнительные инструменты и сервисы (в разработке)
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><Users className="h-5 w-5 text-muted-foreground"/> Детализированное управление портфелем объектов</div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><MessageSquare className="h-5 w-5 text-muted-foreground"/> Чат-бот для оперативной поддержки и консультаций</div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><FileText className="h-5 w-5 text-muted-foreground"/> Генерация специализированных отчетов</div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"><ShieldAlert className="h-5 w-5 text-muted-foreground"/> Анализ налоговых и юридических аспектов сделок</div>
            </CardContent>
        </Card>
    </div>
  );
}
