
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ShieldCheck, Workflow, Users, Gauge, MessageSquare, FileText, SearchCheck, Star, Truck, Bell, Smartphone, Share2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TestKskbPage() {
  const productVision = "Наше видение продукта – создать экосистему доверия и безопасности, которая станет стандартом для B2B и B2C транзакций в России. Мы стремимся построить лидирующую на рынке платформу, где банк выступает гарантом честности и надежности, значительно снижая риски и операционные издержки для всех участников. Наша платформа – это не просто инструмент для проведения сделок, это фундамент для построения долгосрочных и взаимовыгодных отношений между поставщиками и покупателями. Мы добьемся этого, предоставляя полный спектр услуг, обеспечивающих прозрачность, контроль качества и эффективное разрешение споров. В конечном итоге, мы хотим, чтобы каждая сделка, совершенная через нашу платформу, ассоциировалась с уверенностью в успехе и максимальной защитой интересов наших клиентов.";
  
  const features = [
    { icon: <Workflow className="h-5 w-5 text-accent" />, text: "Безопасная эскроу-система с многофакторной аутентификацией" },
    { icon: <SearchCheck className="h-5 w-5 text-accent" />, text: "Автоматизированная проверка контрагентов" },
    { icon: <MessageSquare className="h-5 w-5 text-accent" />, text: "Встроенный механизм разрешения споров с привлечением экспертов банка" },
    { icon: <Star className="h-5 w-5 text-accent" />, text: "Система рейтингов и отзывов" },
    { 
      icon: <ShieldCheck className="h-5 w-5 text-accent" />, 
      text: "Страхование сделок от неисполнения обязательств",
      href: "/deal-insurance",
      isServiceLink: true,
    },
    { icon: <Truck className="h-5 w-5 text-accent" />, text: "Интеграция с логистическими компаниями для отслеживания доставки" },
    { icon: <FileText className="h-5 w-5 text-accent" />, text: "Инструменты для автоматизации документооборота" },
    { icon: <Users className="h-5 w-5 text-accent" />, text: "Персонализированные панели управления для поставщиков и покупателей" },
    { icon: <Bell className="h-5 w-5 text-accent" />, text: "Система уведомлений о статусе сделки" },
    { icon: <Gauge className="h-5 w-5 text-accent" />, text: "Аналитика и отчетность по сделкам" },
    { icon: <Smartphone className="h-5 w-5 text-accent" />, text: "Мобильное приложение для управления сделками на ходу" },
    { icon: <Share2 className="h-5 w-5 text-accent" />, text: "API для интеграции с существующими системами учета и CRM клиентов" },
    { icon: <Eye className="h-5 w-5 text-accent" />, text: "Функционал проверки качества товаров и услуг с привлечением независимых экспертов" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto py-8 space-y-8">
      <Card className="shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <ShieldCheck className="h-16 w-16 text-accent" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">
            Тест с КСКБ: Экосистема Доверия
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
            Платформа для безопасных B2B и B2C транзакций, где банк выступает гарантом надежности.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 bg-secondary/30 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold text-primary mb-3">Видение продукта</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {productVision}
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-primary mb-4">Ключевой функционал</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-card rounded-md shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-shrink-0 mt-1">{feature.icon}</div>
                  {feature.isServiceLink && feature.href ? (
                    <Button asChild variant="link" className="p-0 h-auto text-sm text-foreground hover:text-accent text-left justify-start flex-grow text-wrap">
                      <Link href={feature.href}>
                        {feature.text}
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm text-foreground">{feature.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Этот сервис находится в стадии концептуализации. Следите за обновлениями!
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
