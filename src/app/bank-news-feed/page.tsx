
import BankNewsFeed from '@/components/app/BankNewsFeed';

export default function BankNewsFeedPage() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2 text-center text-foreground">
        Новостной фон Банка ДОМ.РФ
      </h1>
      <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
        Автоматически обновляемая лента новостей о Банке ДОМ.РФ с AI-анализом тональности. (Данные симулированы)
      </p>
      <BankNewsFeed />
    </div>
  );
}
