
import BrainstormBacklogCreator from '@/components/app/BrainstormBacklogCreator';

export default function BrainstormBacklogPage() {
  return (
    <div className="w-full max-w-6xl mx-auto py-8"> {/* Increased max-width */}
      <h1 className="text-3xl font-bold mb-2 text-center text-foreground">
        Создатель бэклога по схемам брейншторма
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
        Загрузите PDF-файл с результатами брейншторм-сессии. AI поможет структурировать идеи, сформировать бэклог с ICE-оценками и визуализировать его.
      </p>
      <BrainstormBacklogCreator />
    </div>
  );
}
