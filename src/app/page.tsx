
import ServiceTile from '@/components/app/ServiceTile';
import { Lightbulb, FileText, CalendarClock, Layers, FileSignature, Landmark, Building2, Home, Brain, FileCheck2, ShieldCheck, ShieldAlert, FileArchive, SearchCode, ClipboardList, ListTodo } from 'lucide-react'; // Added ListTodo

export default function HomePage() {
  const services = [
    {
      title: 'VisionCraft',
      description: 'Инструмент для пошагового формирования видения продукта, от идеи до технического задания, с помощью AI.',
      href: '/vision-craft',
      icon: <Lightbulb className="h-8 w-8" />,
    },
    {
      title: 'Анализатор Документов',
      description: 'Загрузите документ, и AI предоставит краткую сводку и определит его тип.',
      href: '/document-analyzer',
      icon: <FileText className="h-8 w-8" />,
    },
    {
      title: 'События в документе',
      description: 'Загрузите документ, и AI извлечет из него события с датами и описаниями.',
      href: '/document-events',
      icon: <CalendarClock className="h-8 w-8" />,
    },
    {
      title: 'Архитектурные Скетчи',
      description: 'Загрузите ТЗ, и AI сгенерирует концептуальную и прикладную архитектуру в виде изображения.',
      href: '/architectural-sketches',
      icon: <Layers className="h-8 w-8" />,
    },
    {
      title: 'Договорной Помощник',
      description: 'Анализ договоров, извлечение условий, событий, формирование распоряжений и чат с AI по документу.',
      href: '/contract-assistant',
      icon: <FileSignature className="h-8 w-8" />,
    },
    {
      title: 'Распоряжение о постановке на учет (Кредитные договоры)',
      description: 'Автоматическое формирование проекта распоряжения из PDF кредитного договора с возможностью редактирования и экспорта.',
      href: '/credit-disposition',
      icon: <FileArchive className="h-8 w-8" />,
    },
    {
      title: 'Робоэдвайзер по недвижимости (Частный)',
      description: 'AI-консультант для формирования инвестиционного плана в сфере недвижимости для частных лиц.',
      href: '/robo-advisor',
      icon: <Landmark className="h-8 w-8" />,
    },
    {
      title: 'Корпоративный Робоэдвайзер по недвижимости',
      description: 'AI-консультант для формирования стратегического инвестиционного плана в сфере недвижимости для корпоративных клиентов.',
      href: '/corporate-robo-advisor',
      icon: <Building2 className="h-8 w-8" />,
    },
    {
      title: 'Домашний лизинг (Корпоративный)',
      description: 'AI-ассистент для корпоративных клиентов по подбору объектов и расчету условий лизинга недвижимости и оборудования.',
      href: '/home-leasing',
      icon: <Home className="h-8 w-8" />,
    },
    {
      title: 'InnovHub: Центр Инноваций',
      description: 'Платформа для сбора, анализа и управления инновационными идеями сотрудников с поддержкой AI.',
      href: '/innovhub',
      icon: <Brain className="h-8 w-8" />,
    },
    {
      title: 'КСКБ проверка ДДУ',
      description: 'Автоматизированная проверка договоров долевого участия (ДДУ) по настраиваемому чек-листу.',
      href: '/kskb-ddu-check',
      icon: <FileCheck2 className="h-8 w-8" />,
    },
    {
      title: 'Тест с КСКБ',
      description: 'Экосистема доверия и безопасности для B2B и B2C транзакций, где банк выступает гарантом честности и надежности.',
      href: '/test-kskb',
      icon: <ShieldCheck className="h-8 w-8" />,
    },
     {
      title: 'Страхование сделок',
      description: 'Минимизация рисков пользователей от неисполнения обязательств контрагентами.',
      href: '/deal-insurance',
      icon: <ShieldAlert className="h-8 w-8" />,
    },
    {
      title: 'Проверка реестра платежей на триггеры КСКБ',
      description: 'Автоматическая сверка платежей из Excel по заданному списку триггеров.',
      href: '/payment-trigger-check',
      icon: <SearchCode className="h-8 w-8" />,
    },
    {
      title: 'Создатель бэклога по схемам брейншторма',
      description: 'Анализ PDF с результатами брейншторма, генерация бэклога с ICE-оценками и визуализацией.',
      href: '/brainstorm-backlog',
      icon: <ClipboardList className="h-8 w-8" />,
    },
    {
      title: 'Подготовка к БК',
      description: 'AI-ассистент для проверки полноты бэклога продукта (истории, цели, критерии) и генерации предложений.',
      href: '/backlog-prep',
      icon: <ListTodo className="h-8 w-8" />,
    },
    // Add more services here in the future
  ];

  const renderPlaceholders = () => {
    const numServices = services.length;
    const itemsPerRow = 3; // Corresponds to lg:grid-cols-3

    // If no services, show 3 placeholders
    if (numServices === 0) {
      return Array.from({ length: itemsPerRow }).map((_, index) => (
        <div key={`placeholder-empty-${index}`} className="bg-card/50 border-2 border-dashed border-muted rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center text-center opacity-75">
           <svg className="w-12 h-12 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          <p className="text-muted-foreground font-medium">Новый сервис скоро</p>
          <p className="text-xs text-muted-foreground mt-1">Мы работаем над расширением ваших возможностей</p>
        </div>
      ));
    }

    // Calculate placeholders needed to fill the last row
    const placeholdersNeeded = (itemsPerRow - (numServices % itemsPerRow)) % itemsPerRow;
    
    if (placeholdersNeeded === 0 && numServices > 0) { 
      return null; 
    }
    
    const countToRender = numServices === 0 ? itemsPerRow : placeholdersNeeded;


    return Array.from({ length: countToRender }).map((_, index) => (
      <div key={`placeholder-fill-${index}`} className="bg-card/50 border-2 border-dashed border-muted rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center text-center opacity-75">
         <svg className="w-12 h-12 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        <p className="text-muted-foreground font-medium">Новый сервис скоро</p>
        <p className="text-xs text-muted-foreground mt-1">Мы работаем над расширением ваших возможностей</p>
      </div>
    ));
  };


  return (
    <div className="space-y-12">
      <section className="text-center py-10 bg-card shadow-md rounded-lg">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary-foreground">
          Добро пожаловать в AI Мастерскую!
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Ваш центр управления AI-инструментами для инноваций и эффективной разработки продуктов.
        </p>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-8 text-center text-foreground">
          Доступные Инструменты
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <ServiceTile
              key={service.title}
              title={service.title}
              description={service.description}
              href={service.href}
              icon={service.icon}
            />
          ))}
          {renderPlaceholders()}
        </div>
      </section>
    </div>
  );
}
