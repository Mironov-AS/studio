
import ContractAssistantService from '@/components/app/ContractAssistantService';

export default function ContractAssistantPage() {
  return (
    <div className="w-full max-w-5xl mx-auto py-8"> {/* Increased max-width */}
      <h1 className="text-3xl font-bold mb-6 text-center text-foreground">
        Договорной Помощник
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
        Загрузите или введите текст договора для анализа, извлечения ключевых условий, событий, формирования распоряжений и общения с AI-ассистентом по документу.
      </p>
      <ContractAssistantService />
    </div>
  );
}
