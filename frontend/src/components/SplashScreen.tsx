import { Dumbbell } from 'lucide-react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-splash flex flex-col items-center justify-center bg-black">
      <div className="animate-in fade-in zoom-in duration-700">
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/50">
          <Dumbbell className="h-16 w-16 text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>
      <h1 className="mt-8 text-4xl font-black text-white animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        Gym Tracker
      </h1>
      <p className="mt-2 text-lg text-white/60 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
        Track. Train. Transform.
      </p>
    </div>
  );
}
