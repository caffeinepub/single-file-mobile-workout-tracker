import { useState, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserProfile } from '../backend';
import { useGetWorkoutHistory, useGetLegSubgroupRecovery } from '../hooks/useQueries';
import StatusBar from '../components/StatusBar';
import PullToRefresh from '../components/PullToRefresh';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, TrendingUp, Calendar, Weight, Dumbbell, Flame, Plus, Activity } from 'lucide-react';
import { toast } from 'sonner';

const RecoveryHeatmap = lazy(() => import('../components/RecoveryHeatmap'));
const BodyweightModal = lazy(() => import('../components/BodyweightModal'));

interface DashboardPageProps {
  userProfile: UserProfile;
  onNavigateToNewWorkout: () => void;
  onNavigateToHistory: () => void;
  onNavigateToProgress: () => void;
}

// Feature flag for weighted leg average calculation
const USE_WEIGHTED_LEG_AVG = false;

// Helper function to detect and convert nanosecond timestamps
function convertTimestamp(timestamp: bigint): number {
  if (!timestamp || timestamp === 0n) {
    return 0;
  }
  
  const numTimestamp = Number(timestamp);
  
  // Detect nanosecond timestamps (≥1e12 threshold)
  if (numTimestamp >= 1e12) {
    // Convert nanoseconds to milliseconds
    return numTimestamp / 1_000_000;
  }
  
  // Already in milliseconds
  return numTimestamp;
}

export default function DashboardPage({ userProfile, onNavigateToNewWorkout, onNavigateToHistory, onNavigateToProgress }: DashboardPageProps) {
  const [showBodyweightModal, setShowBodyweightModal] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: workoutHistory = [], isLoading: historyLoading } = useGetWorkoutHistory();
  const { data: legSubgroupRecovery, isLoading: legSubgroupLoading } = useGetLegSubgroupRecovery();

  const handleVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
    await queryClient.invalidateQueries({ queryKey: ['recoveryState'] });
    await queryClient.invalidateQueries({ queryKey: ['legSubgroupRecovery'] });
    await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    toast.success('Dashboard refreshed');
  };

  const getFrequencyText = () => {
    switch (userProfile.trainingFrequency) {
      case 'threeDays':
        return '3 days/week';
      case 'fourDays':
        return '4 days/week';
      case 'fiveDays':
        return '5 days/week';
      default:
        return '';
    }
  };

  const formatDate = (timestamp: bigint) => {
    try {
      const milliseconds = convertTimestamp(timestamp);
      if (milliseconds <= 0) {
        return 'Invalid date';
      }
      const date = new Date(milliseconds);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const formatVolume = (volume: number) => {
    const displayVolume = userProfile.weightUnit === 'kg' 
      ? volume 
      : volume * 2.20462;
    return `${displayVolume.toFixed(0)} ${userProfile.weightUnit}`;
  };

  const calculateStreak = () => {
    if (workoutHistory.length === 0) return 0;
    
    const sortedWorkouts = [...workoutHistory].sort((a, b) => {
      const aMs = convertTimestamp(a.timestamp);
      const bMs = convertTimestamp(b.timestamp);
      return bMs - aMs;
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);
    
    for (const workout of sortedWorkouts) {
      const milliseconds = convertTimestamp(workout.timestamp);
      if (milliseconds <= 0) continue;
      
      const workoutDate = new Date(milliseconds);
      if (isNaN(workoutDate.getTime())) continue;
      
      workoutDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0 || daysDiff === 1) {
        streak++;
        currentDate = new Date(workoutDate);
      } else {
        break;
      }
    }
    
    return streak;
  };

  const calculateWeeklyStats = () => {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const weeklyWorkouts = workoutHistory.filter(w => {
      const ms = convertTimestamp(w.timestamp);
      return ms > 0 && ms >= oneWeekAgo;
    });
    const totalVolume = weeklyWorkouts.reduce((sum, w) => sum + w.totalVolume, 0);
    
    const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
    const previousWeekWorkouts = workoutHistory.filter(w => {
      const ms = convertTimestamp(w.timestamp);
      return ms > 0 && ms >= twoWeeksAgo && ms < oneWeekAgo;
    });
    
    const previousVolume = previousWeekWorkouts.reduce((sum, w) => sum + w.totalVolume, 0);
    const volumeGain = previousVolume > 0 
      ? ((totalVolume - previousVolume) / previousVolume) * 100 
      : 0;
    
    return {
      workoutsCount: weeklyWorkouts.length,
      totalVolume,
      volumeGain: Math.round(volumeGain),
    };
  };

  const streak = historyLoading ? 0 : calculateStreak();
  const weeklyStats = historyLoading ? { workoutsCount: 0, totalVolume: 0, volumeGain: 0 } : calculateWeeklyStats();

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex min-h-screen flex-col bg-background pb-24">
        <StatusBar streak={streak} />

        <main className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-lg text-muted-foreground">Ready to crush your workout?</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {historyLoading ? (
                <>
                  <Card className="shadow-glow-primary border-2 border-primary/30 transition-all hover:shadow-glow-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-glow-accent border-2 border-accent/30 transition-all hover:shadow-glow-accent">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="shadow-glow-primary border-2 border-primary/30 transition-all hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98]">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 shadow-glow-primary">
                          <Flame className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Workout Streak</p>
                          <p className="text-3xl font-bold text-primary">{streak} days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-glow-accent border-2 border-accent/30 transition-all hover:shadow-glow-accent hover:scale-[1.02] active:scale-[0.98]">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">This Week</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-bold text-accent">{weeklyStats.workoutsCount} workouts</p>
                          {weeklyStats.volumeGain !== 0 && (
                            <Badge variant={weeklyStats.volumeGain > 0 ? "default" : "secondary"} className="text-xs">
                              {weeklyStats.volumeGain > 0 ? '+' : ''}{weeklyStats.volumeGain}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatVolume(weeklyStats.totalVolume)} total volume
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 shadow-glow-primary transition-all hover:shadow-glow-primary hover:scale-[1.01] active:scale-[0.99]">
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-glow-primary">
                    <Play className="h-12 w-12 fill-primary-foreground text-primary-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">Start Your Workout</h2>
                    <p className="text-lg text-muted-foreground">
                      Track your exercises, sets, and reps
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => {
                      handleVibrate();
                      onNavigateToNewWorkout();
                    }}
                    className="w-full max-w-xs text-lg font-semibold shadow-glow-primary transition-all hover:shadow-glow-primary hover:scale-105 active:scale-95 sm:w-auto h-14 rounded-2xl"
                  >
                    <Play className="mr-2 h-6 w-6 fill-current" />
                    Start Workout
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Suspense fallback={
              <Card className="shadow-sm border-border/50">
                <CardHeader>
                  <CardTitle>Muscle Recovery</CardTitle>
                  <CardDescription>Track your muscle group recovery status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-16" />
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            }>
              <RecoveryHeatmap 
                legSubgroupRecovery={legSubgroupRecovery}
                legSubgroupLoading={legSubgroupLoading}
                useWeightedLegAvg={USE_WEIGHTED_LEG_AVG}
              />
            </Suspense>

            <Card 
              className="shadow-sm border-border/50 transition-all hover:border-primary/50 hover:shadow-glow-primary hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              onClick={() => {
                handleVibrate();
                onNavigateToProgress();
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Progress Tracking
                    </CardTitle>
                    <CardDescription>View detailed muscle recovery visualization</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="shadow-sm border-border/50 transition-all hover:border-primary/50 hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98]">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2 text-base">
                    <Weight className="h-5 w-5 text-primary" />
                    Bodyweight
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {userProfile.bodyweight} {userProfile.weightUnit}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/50 transition-all hover:border-accent/50 hover:shadow-glow-accent hover:scale-[1.02] active:scale-[0.98]">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2 text-base">
                    <Calendar className="h-5 w-5 text-accent" />
                    Frequency
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{getFrequencyText()}</div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/50 transition-all hover:border-primary/50 hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98]">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Total Workouts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    <div className="text-3xl font-bold">{workoutHistory.length}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Recent Workouts</CardTitle>
                    <CardDescription className="text-base">Your latest training sessions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-4 rounded-lg border border-border/50 p-4">
                        <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : workoutHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                      <TrendingUp className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-base text-muted-foreground">
                      No workouts yet. Start your first session to see your progress!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workoutHistory.slice(0, 3).map((workout, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-4 rounded-lg border border-border/50 p-4 transition-all hover:border-primary/50 hover:shadow-glow-primary hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20 shadow-glow-primary">
                          <Dumbbell className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-semibold">
                              {workout.exercises.length} exercises
                            </p>
                            <p className="text-base text-muted-foreground">
                              {formatDate(workout.timestamp)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap gap-1">
                              {workout.exercises.slice(0, 2).map((ex, exIdx) => (
                                <Badge key={exIdx} variant="secondary" className="text-sm">
                                  {ex.exercise.name}
                                </Badge>
                              ))}
                              {workout.exercises.length > 2 && (
                                <Badge variant="outline" className="text-sm">
                                  +{workout.exercises.length - 2} more
                                </Badge>
                              )}
                            </div>
                            {workout.totalVolume > 0 && (
                              <Badge variant="default" className="text-sm">
                                {formatVolume(workout.totalVolume)} total
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        <Button
          size="lg"
          onClick={() => {
            handleVibrate();
            setShowBodyweightModal(true);
          }}
          className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-glow-primary hover:shadow-glow-primary hover:scale-110 transition-all active:scale-90 z-40"
        >
          <Plus className="h-8 w-8" />
          <span className="sr-only">Log Bodyweight</span>
        </Button>

        {showBodyweightModal && (
          <Suspense fallback={null}>
            <BodyweightModal
              open={showBodyweightModal}
              onOpenChange={setShowBodyweightModal}
              userProfile={userProfile}
            />
          </Suspense>
        )}
      </div>
    </PullToRefresh>
  );
}
