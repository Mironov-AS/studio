import DocumentEventsExtractor from '@/components/app/DocumentEventsExtractor';

export default function DocumentEventsPage() {
  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-foreground">
        Извлечение Событий из Документа
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-lg mx-auto">
        Загрузите документ (например, TXT, PDF, PNG, JPG), и AI извлечет из него события с датами и краткими описаниями.
      </p>
      <DocumentEventsExtractor />
    </div>
  );
}
