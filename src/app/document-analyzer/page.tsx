import DocumentAnalyzer from '@/components/app/DocumentAnalyzer';

export default function DocumentAnalyzerPage() {
  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-foreground">
        Анализатор Документов
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-lg mx-auto">
        Загрузите документ (например, TXT, PDF, PNG, JPG), и AI предоставит краткую сводку и определит его тип.
      </p>
      <DocumentAnalyzer />
    </div>
  );
}
