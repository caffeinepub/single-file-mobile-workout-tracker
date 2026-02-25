import { useMemo, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetWorkoutHistory } from '../hooks/useQueries';
import { UserProfile } from '../backend';
import PullToRefresh from '../components/PullToRefresh';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dumbbell, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';

// Lazy load Calendar component
const Calendar = lazy(() => import('@/components/ui/calendar').then(module => ({ default: module.Calendar })));

interface HistoryPageProps {
  userProfile: UserProfile;
  onBack: () => void;
}

// Helper function to detect and convert nanosecond timestamps
function convertTimestamp(timestamp: bigint): number {
  if (!timestamp || timestamp === 0n) {
    return 0;
  }
  
  const numTimestamp = Number(timestamp);
  
  // Detect nanosecond timestamps (≥1e12 threshold)
  // Nanosecond timestamps are typically 19 digits, millisecond timestamps are 13 digits
  if (numTimestamp >= 1e12) {
    // Convert nanoseconds to milliseconds
    return numTimestamp / 1_000_000;
  }
  
  // Already in milliseconds
  return numTimestamp;
}

export default function HistoryPage({ userProfile, onBack }: HistoryPageProps) {
  const { data: workoutHistory = [], isLoading } = useGetWorkoutHistory();
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
    toast.success('History refreshed');
  };

  const formatDate = (timestamp: bigint) => {
    // Defensive check for missing or zero timestamps
    if (!timestamp || timestamp === 0n) {
      return 'No date available';
    }
    
    try {
      // Convert timestamp (handles both nanoseconds and milliseconds)
      const milliseconds = convertTimestamp(timestamp);
      
      // Additional validation
      if (milliseconds <= 0 || milliseconds > Date.now() + 86400000) {
        return 'Invalid date';
      }
      
      const date = new Date(milliseconds);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      // Format: HH:mm AM/PM, MMM DD, YYYY
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      
      return `${timeStr}, ${dateStr}`;
    } catch (error) {
      console.error('Error formatting date:', error, 'timestamp:', timestamp);
      return 'Invalid date';
    }
  };

  const formatVolume = (volume: number) => {
    const displayVolume = userProfile.weightUnit === 'kg' 
      ? volume 
      : volume * 2.20462;
    return `${displayVolume.toFixed(0)} ${userProfile.weightUnit}`;
  };

  // Get trained dates for calendar with proper validation
  const trainedDates = useMemo(() => {
    return workoutHistory
      .filter(workout => {
        if (!workout.timestamp || workout.timestamp === 0n) return false;
        const milliseconds = convertTimestamp(workout.timestamp);
        return milliseconds > 0 && milliseconds <= Date.now() + 86400000;
      })
      .map(workout => {
        try {
          const milliseconds = convertTimestamp(workout.timestamp);
          const date = new Date(milliseconds);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      })
      .filter((date): date is Date => date !== null);
  }, [workoutHistory]);

  const modifiers = {
    trained: trainedDates,
  };

  const modifiersStyles = {
    trained: {
      fontWeight: 'bold',
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      borderRadius: '0.375rem',
    },
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex min-h-screen flex-col bg-background pb-24">
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Workout History</h1>
              <p className="text-lg text-muted-foreground">Your training journey</p>
            </div>

            {/* Calendar View - Lazy loaded */}
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Training Calendar
                </CardTitle>
                <CardDescription>Days you trained are highlighted</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                {isLoading ? (
                  <Skeleton className="h-80 w-full max-w-md rounded-md" />
                ) : (
                  <Suspense fallback={<Skeleton className="h-80 w-full max-w-md rounded-md" />}>
                    <Calendar
                      mode="single"
                      modifiers={modifiers}
                      modifiersStyles={modifiersStyles}
                      className="rounded-md border border-border/50"
                    />
                  </Suspense>
                )}
              </CardContent>
            </Card>

            {/* Workout History List */}
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Workouts
                </CardTitle>
                <CardDescription>Your last 5 training sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Card key={i} className="border-2 border-border/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-lg" />
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </div>
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Skeleton className="h-20 w-full rounded-lg" />
                          <Skeleton className="h-20 w-full rounded-lg" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : workoutHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No workouts yet. Start your first session to see your progress!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workoutHistory.map((workout, idx) => (
                      <Card key={idx} className="border-2 border-border/50 transition-all hover:border-primary/50 active:scale-[0.98]">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <Dumbbell className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base">
                                  {workout.exercises.length} Exercises
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {formatDate(workout.timestamp)}
                                </CardDescription>
                              </div>
                            </div>
                            {workout.totalVolume > 0 && (
                              <Badge variant="default" className="text-xs">
                                {formatVolume(workout.totalVolume)} total
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {workout.exercises.map((ex, exIdx) => (
                            <div key={exIdx} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-semibold">{ex.exercise.name}</p>
                                <Badge variant="secondary" className="text-xs">
                                  {ex.exercise.primaryMuscleGroup}
                                </Badge>
                              </div>
                              {ex.setData.length > 0 ? (
                                <div className="space-y-1">
                                  {ex.setData.map((set, setIdx) => (
                                    <div key={setIdx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="font-medium">Set {setIdx + 1}:</span>
                                      <span>
                                        {userProfile.weightUnit === 'kg' 
                                          ? set.weight.toFixed(1) 
                                          : (set.weight * 2.20462).toFixed(1)}{' '}
                                        {userProfile.weightUnit} × {String(set.reps)} reps
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {Number(ex.sets)} sets × {String(ex.reps)} reps (planned)
                                </p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </PullToRefresh>
  );
}
