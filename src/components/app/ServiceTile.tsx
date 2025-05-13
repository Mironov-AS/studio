"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface ServiceTileProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export default function ServiceTile({ title, description, href, icon }: ServiceTileProps) {
  return (
    <Card className="h-full flex flex-col hover:shadow-accent/10 hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1.5 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-x-4">
          <div className="p-3 bg-accent/10 rounded-lg text-accent flex items-center justify-center">
            {/* Icon should have size set when passed, e.g., <Rocket className="h-8 w-8" /> */}
            {icon}
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-4">
        <CardDescription className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {description}
        </CardDescription>
      </CardContent>
      <CardFooter className="pt-2 mt-auto"> {/* mt-auto pushes footer to bottom */}
        <Button asChild variant="ghost" className="p-0 h-auto text-accent font-semibold hover:text-accent/90 hover:bg-transparent group">
          <Link href={href}>
            Перейти к сервису
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
