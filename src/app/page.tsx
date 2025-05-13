import ServiceTile from '@/components/app/ServiceTile';
import { Lightbulb } from 'lucide-react';

export default function HomePage() {
  const services = [
    {
      title: 'VisionCraft',
      description: 'Инструмент для пошагового формирования видения продукта, от идеи до технического задания, с помощью AI.',
      href: '/vision-craft',
      icon: <Lightbulb className="h-8 w-8" />, // Using Lightbulb for "idea/vision"
    },
    // Add more services here in the future
    // Example:
    // {
    //   title: 'TechSpec Analyzer',
    //   description: 'Анализ технических заданий на полноту и соответствие стандартам.',
    //   href: '/tech-spec-analyzer',
    //   icon: <FileText className="h-8 w-8" />,
    // },
  ];

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
        </div>
        {services.length < 3 && ( // Show placeholders if less than 3 services to fill a row
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
            {Array.from({ length: Math.max(0, (services.length === 1 ? 2 : 1)) }).map((_, index) => (
              <div key={`placeholder-${index}`} className="bg-card/50 border-2 border-dashed border-muted rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center text-center opacity-75">
                 <svg className="w-12 h-12 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                <p className="text-muted-foreground font-medium">Новый сервис скоро</p>
                <p className="text-xs text-muted-foreground mt-1">Мы работаем над расширением ваших возможностей</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
