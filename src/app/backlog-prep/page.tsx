
import BacklogPrepAssistant from '@/components/app/BacklogPrepAssistant';

export default function BacklogPrepPage() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8"> {/* Increased max-width */}
      <h1 className="text-3xl font-bold mb-2 text-center text-foreground">
        Подготовка бэклога к БК (Бюджетному Комитету)
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-3xl mx-auto">
        Загрузите Excel-файл с бэклогом продукта. AI поможет проверить полноту пользовательских историй, целей и критериев приемки, а также предложит варианты для незаполненных полей.
      </p>
      <BacklogPrepAssistant />
    </div>
  );
}
