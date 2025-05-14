
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod"; // Imported z from zod
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { generateRealEstateAdvice, type GenerateRealEstateAdviceInput, type GenerateRealEstateAdviceOutput } from "@/ai/flows/generate-real-estate-advice-flow";
import { Loader2, Sparkles, Landmark, TrendingUp, MapPin, ListChecks, Lightbulb, HandCoins, ShieldCheck, Clock3, BriefcaseBusiness, AreaChart, Building } from 'lucide-react'; // Added Building
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const investmentHorizons = ['Краткосрочный (до 1 года)', 'Среднесрочный (1-5 лет)', 'Долгосрочный (более 5 лет)'] as const;
const riskLevels = ['Низкий', 'Средний', 'Высокий'] as const;
const propertyTypes = ['Квартиры', 'Коммерческая недвижимость', 'Земельные участки', 'Любой'] as const;
const budgets = ['до 5 млн руб', '5-15 млн руб', '15-30 млн руб', 'свыше 30 млн руб'] as const;
const investmentGoalOptions = [
  { id: "capital_growth", label: "Рост капитала" },
  { id: "rental_income", label: "Получение арендного дохода" },
  { id: "diversification", label: "Диверсификация портфеля" },
  { id: "capital_preservation", label: "Сохранение средств" },
] as const;


const formSchema = z.object({
  preferredRegion: z.string().min(3, { message: "Укажите регион или город (мин. 3 символа)." }),
  investmentHorizon: z.enum(investmentHorizons, { required_error: "Выберите срок вложений." }),
  riskLevel: z.enum(riskLevels, { required_error: "Выберите уровень риска." }),
  propertyType: z.enum(propertyTypes, { required_error: "Выберите тип недвижимости." }),
  budget: z.enum(budgets, { required_error: "Выберите бюджет." }),
  investmentGoals: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "Выберите хотя бы одну инвестиционную цель.",
  }),
});

type RoboAdvisorFormValues = z.infer<typeof formSchema>;

export default function RoboAdvisor() {
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState<GenerateRealEstateAdviceOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<RoboAdvisorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      preferredRegion: "",
      investmentHorizon: undefined,
      riskLevel: undefined,
      propertyType: undefined,
      budget: undefined,
      investmentGoals: [],
    },
  });

  async function onSubmit(data: RoboAdvisorFormValues) {
    setIsLoading(true);
    setAdvice(null);
    try {
      const result = await generateRealEstateAdvice(data as GenerateRealEstateAdviceInput); // API expects string array
      setAdvice(result);
      toast({
        title: "Инвестиционный план готов!",
        description: "AI успешно сформировал для вас рекомендации.",
      });
    } catch (error) {
      console.error("Error generating real estate advice:", error);
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
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Landmark className="h-8 w-8 text-accent" />
            Робоэдвайзер по инвестициям в недвижимость
          </CardTitle>
          <CardDescription>
            Добро пожаловать в AI-сервис Банка Дом.РФ! Заполните форму ниже, чтобы получить персонализированный
            инвестиционный план по недвижимости, основанный на анализе рыночных данных и ваших целях.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="preferredRegion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Предпочтительный регион/город</FormLabel>
                      <FormControl>
                        <Input placeholder="Например, Сочи или Московская область" {...field} />
                      </FormControl>
                      <FormDescription>Укажите, где вы рассматриваете инвестиции.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Ваш бюджет</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите примерный бюджет" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {budgets.map(budget => <SelectItem key={budget} value={budget}>{budget}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="investmentHorizon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Срок вложений</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите желаемый срок" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {investmentHorizons.map(horizon => <SelectItem key={horizon} value={horizon}>{horizon}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riskLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Уровень риска</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите допустимый уровень риска" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {riskLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Тип недвижимости</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип недвижимости" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="investmentGoals"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Инвестиционные цели</FormLabel>
                        <FormDescription>
                          Выберите одну или несколько целей ваших инвестиций.
                        </FormDescription>
                      </div>
                      <div className="space-y-2">
                        {investmentGoalOptions.map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="investmentGoals"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.label)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), item.label])
                                          : field.onChange(
                                            (field.value || []).filter(
                                                (value) => value !== item.label
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {item.label}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6 rounded-lg">
                {isLoading ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-6 w-6" />
                )}
                Получить инвестиционный план
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="pt-6 text-center">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-lg text-muted-foreground">AI анализирует данные и формирует ваш план... Это может занять некоторое время.</p>
          </CardContent>
        </Card>
      )}

      {advice && !isLoading && (
        <Card className="mt-6 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl text-primary">
              <TrendingUp className="h-8 w-8" />
              Ваш Персональный Инвестиционный План
            </CardTitle>
            <CardDescription>
              На основе предоставленных вами данных, наш AI-робоэдвайзер подготовил следующие рекомендации:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={['summary', 'properties', 'outlook', 'next_steps']} className="w-full space-y-4">
              <AccordionItem value="summary" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-6 w-6 text-accent" />
                    Общее резюме плана
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                  <p className="whitespace-pre-line leading-relaxed">{advice.investmentPlanSummary}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="properties" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline">
                  <div className="flex items-center gap-2">
                     <MapPin className="h-6 w-6 text-accent" />
                    Предлагаемые объекты
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                  {advice.suggestedProperties.map((prop, index) => (
                    <Card key={index} className="bg-secondary/30 shadow-inner">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-primary-foreground">
                          {getPropertyIcon(prop.type)}
                           {prop.type}
                        </CardTitle>
                        <CardDescription className="text-sm">{prop.locationHint}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p><strong>Обоснование:</strong> <span className="whitespace-pre-line">{prop.rationale}</span></p>
                        <p><strong>Потенциал роста:</strong> {prop.potentialGrowth}</p>
                      </CardContent>
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="outlook" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-accent" />
                    Обзор рынка
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                   <p className="whitespace-pre-line leading-relaxed">{advice.marketOutlook}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="next_steps" className="border bg-card rounded-lg shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-xl hover:no-underline">
                  <div className="flex items-center gap-2">
                    <HandCoins className="h-6 w-6 text-accent" />
                    Следующие шаги
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 text-base">
                  <p className="whitespace-pre-line leading-relaxed">{advice.nextSteps}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper component for icon mapping
const getPropertyIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("квартир")) return <BriefcaseBusiness className="h-5 w-5" />;
  if (lowerType.includes("коммерч")) return <AreaChart className="h-5 w-5" />;
  if (lowerType.includes("земельн")) return <Landmark className="h-5 w-5" />;
  return <Building className="h-5 w-5" />; // Default icon
};

