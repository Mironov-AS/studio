
import PaymentTriggerCheck from '@/components/app/PaymentTriggerCheck';

export default function PaymentTriggerCheckPage() {
  return (
    <div className="w-full max-w-6xl mx-auto py-8"> {/* Increased max-width */}
      <h1 className="text-3xl font-bold mb-2 text-center text-foreground">
        Проверка реестра платежей на триггеры КСКБ
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
        Загрузите реестр платежей в формате Excel (.xlsx, .xls) и управляйте списком триггеров для автоматической сверки.
      </p>
      <PaymentTriggerCheck />
    </div>
  );
}
