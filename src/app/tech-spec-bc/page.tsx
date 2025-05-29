
import TechSpecBCGenerator from '@/components/app/TechSpecBCGenerator';

export default function TechSpecBCPage() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2 text-center text-foreground">
        Подготовка ТЗ для Бюджетного Комитета
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
        Загрузите Excel-файл с бэклогом продукта. AI поможет проанализировать его и подготовить техническое задание для оценки подрядчиком.
      </p>
      <TechSpecBCGenerator />
    </div>
  );
}
