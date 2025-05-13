import { Rocket } from 'lucide-react';
import Link from 'next/link';

export default function AppHeader() {
  return (
    <header className="bg-card border-b sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Rocket className="h-7 w-7 text-accent" />
          <span>VisionCraft</span>
        </Link>
        {/* Add navigation items here if needed in the future */}
      </div>
    </header>
  );
}
