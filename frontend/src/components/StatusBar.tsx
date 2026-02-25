import { Flame } from 'lucide-react';

interface StatusBarProps {
  streak: number;
}

export default function StatusBar({ streak }: StatusBarProps) {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="container flex items-center justify-between h-12 px-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">{streak} day streak</span>
        </div>
        <span className="text-sm text-muted-foreground">{today}</span>
      </div>
    </div>
  );
}
