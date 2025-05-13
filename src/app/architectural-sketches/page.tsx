
import ArchitecturalSketchesGenerator from '@/components/app/ArchitecturalSketchesGenerator';

export default function ArchitecturalSketchesPage() {
  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-foreground">
        Архитектурные Скетчи
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-lg mx-auto">
        Загрузите техническое задание (например, TXT, PDF, PNG, JPG), и AI сгенерирует изображение с концептуальной и прикладной архитектурой.
      </p>
      <ArchitecturalSketchesGenerator />
    </div>
  );
}
