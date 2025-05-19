
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ListChecks, DollarSign, UserCheck, FileArchive, ShieldQuestion, LineChart, MessageCircle, Server } from 'lucide-react';

export default function DealInsurancePage() {
  const tzSections = [
    {
      title: "1. Управление заявками на страхование",
      icon: <ListChecks className="h-5 w-5 text-accent" />,
      points: [
        "Регистрация заявок пользователей на страхование сделок.",
        "Проверка и подтверждение правильности заполнения всех полей заявки пользователями.",
        "Автоматическое формирование предложений по страхованию сделок с указанием суммы покрытия, размера премии и условий договора."
      ]
    },
    {
      title: "2. Расчёт страховых премий",
      icon: <DollarSign className="h-5 w-5 text-accent" />,
      points: [
        "Автоматический расчёт страховых премий в зависимости от объёма сделки, характеристик контрагента и уровня риска.",
        "Возможность настройки коэффициентов и алгоритмов расчёта премий администратором системы."
      ]
    },
    {
      title: "3. Оценка надёжности контрагентов",
      icon: <UserCheck className="h-5 w-5 text-accent" />,
      points: [
        "Интеграция с внешними базами данных и системами оценки репутации организаций.",
        "Проведение автоматического анализа благонадежности контрагентов перед принятием решения о предоставлении страховки."
      ]
    },
    {
      title: "4. Формирование и хранение полисов",
      icon: <FileArchive className="h-5 w-5 text-accent" />,
      points: [
        "Генерация электронных полисов страхования в стандартизированном формате PDF.",
        "Хранение и архивирование подписанных документов и актов выполненных работ в защищённом хранилище."
      ]
    },
    {
      title: "5. Мониторинг исполнения обязательств",
      icon: <ShieldQuestion className="h-5 w-5 text-accent" />,
      points: [
        "Предоставление пользователям возможности отслеживать состояние текущих сделок и сроки исполнения обязательств партнёров.",
        "Отправка уведомлений и предупреждений при возникновении нарушений сроков или угроз невыполнения обязательств."
      ]
    },
    {
      title: "6. Организация процедур выплаты компенсаций",
      icon: <DollarSign className="h-5 w-5 text-accent" />,
      points: [
        "Определение критериев наступления страхового случая и соответствующих правил выплаты компенсации.",
        "Быстрая обработка претензий пользователей и принятие решений относительно выплат по убыткам."
      ]
    },
    {
      title: "7. Аналитика и отчётность",
      icon: <LineChart className="h-5 w-5 text-accent" />,
      points: [
        "Сбор статистики по заключённым договорам, размеру премий и количеству случаев выплат.",
        "Подготовка отчётов для внутренних нужд компании и внешних контролирующих органов."
      ]
    },
    {
      title: "8. Поддержка пользователей",
      icon: <MessageCircle className="h-5 w-5 text-accent" />,
      points: [
        "Организация службы поддержки пользователей через различные каналы коммуникации (телефон, электронная почта, чаты).",
        "Консультация пользователей по вопросам оформления полисов, действий при наступлении страхового случая и порядка подачи претензий."
      ]
    },
    {
      title: "9. Безопасность и защита данных",
      icon: <ShieldCheck className="h-5 w-5 text-accent" />,
      points: [
        "Использование современных методов шифрования и аутентификации для предотвращения несанкционированного доступа к персональным данным и конфиденциальной информации.",
        "Реализация механизмов резервного копирования базы данных и восстановления работоспособности системы в экстренных ситуациях."
      ]
    }
  ];

  const briefDescription = "Система предназначена для минимизации рисков пользователей, возникающих в связи с возможными нарушениями условий договоров партнёрами и контрагентами. Она обеспечивает автоматизацию процесса управления такими рисками путём предоставления инструментов анализа, расчёта страховых сумм и быстрого реагирования на возникновение проблемных ситуаций.";
  const additionalRequirements = "Система должна поддерживать интеграцию с существующими корпоративными информационными системами и платформами обмена информацией с клиентами и партнёрами.";
  const conclusion = "Реализованная система станет эффективным инструментом для снижения коммерческих рисков и повышения устойчивости бизнеса клиентов, обеспечивая быстрое оформление страховых договоров и эффективное управление потенциальными потерями от неисполнения обязательств контрагентами.";


  return (
    <div className="w-full max-w-4xl mx-auto py-8 space-y-8">
      <Card className="shadow-xl rounded-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <ShieldAlert className="h-16 w-16 text-accent" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">
            Страхование сделок от неисполнения обязательств
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
            {briefDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-primary mb-4">Основные функциональные требования</h2>
            <div className="space-y-4">
              {tzSections.map((section, index) => (
                <Card key={index} className="bg-card shadow">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {section.icon}
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm text-muted-foreground">
                      {section.points.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t">
            <h2 className="text-2xl font-semibold text-primary mb-3">Дополнительные требования</h2>
            <p className="text-muted-foreground leading-relaxed">
              {additionalRequirements}
            </p>
          </div>

          <div className="pt-4 border-t">
            <h2 className="text-2xl font-semibold text-primary mb-3">Заключение</h2>
            <p className="text-muted-foreground leading-relaxed">
              {conclusion}
            </p>
          </div>

        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Этот сервис находится в стадии концептуализации и детальной проработки. Следите за обновлениями!
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
