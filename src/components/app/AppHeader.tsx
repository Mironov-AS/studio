import { Layers } from 'lucide-react'; // Changed icon to represent a "stack" or "collection" of tools
import Link from 'next/link';

export default function AppHeader() {
  return (
    <header className="bg-card border-b sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:text-primary/90 transition-colors">
          <Layers className="h-7 w-7 text-accent" />
          <span>AI Мастерская</span>
        </Link>
        {/* Add navigation items here if needed in the future 
        <nav className="flex gap-4">
          <Link href="/vision-craft" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            VisionCraft
          </Link>
        </nav>
        */}
      </div>
    </header>
  );
}
