import { useQueryClient } from '@tanstack/react-query';
import { useGetRecoveryState, useGetWeeklyMuscleGroupVolume } from '../hooks/useQueries';
import { UserProfile } from '../backend';
import { RecoveryState } from '../types';
import PullToRefresh from '../components/PullToRefresh';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProgressPageProps {
  userProfile: UserProfile;
  onBack: () => void;
}

export default function ProgressPage({ userProfile, onBack }: ProgressPageProps) {
  const { data: recoveryState, isLoading: recoveryLoading } = useGetRecoveryState();
  const { data: weeklyVolume = [], isLoading: volumeLoading } = useGetWeeklyMuscleGroupVolume();
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['recoveryState'] });
    await queryClient.invalidateQueries({ queryKey: ['weeklyMuscleGroupVolume'] });
    toast.success('Progress data refreshed');
  };

  const getRecoveryColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRecoveryTextColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-400';
    if (percentage >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRecoveryStatus = (percentage: number): string => {
    if (percentage >= 100) return 'Fully Recovered';
    if (percentage >= 80) return 'Ready';
    if (percentage >= 50) return 'Recovering';
    return 'Needs Rest';
  };

  const muscleGroups = [
    { key: 'chest', label: 'Chest' },
    { key: 'back', label: 'Back' },
    { key: 'legs', label: 'Legs (Unified)' },
    { key: 'shoulders', label: 'Shoulders' },
    { key: 'arms', label: 'Arms' },
    { key: 'core', label: 'Core' },
  ];

  const legSubgroups = [
    { key: 'quadsRecovery', label: 'Quads' },
    { key: 'hamstringsRecovery', label: 'Hamstrings' },
    { key: 'glutesRecovery', label: 'Glutes' },
    { key: 'calvesRecovery', label: 'Calves' },
  ];

  const formatVolume = (volume: number) => {
    const displayVolume = userProfile.weightUnit === 'kg' 
      ? volume 
      : volume * 2.20462;
    return `${displayVolume.toFixed(0)} ${userProfile.weightUnit}`;
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex min-h-screen flex-col bg-background pb-24">
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Progress</h1>
              <p className="text-lg text-muted-foreground">
                Track your muscle group recovery and training volume
              </p>
            </div>

            {/* Recovery Status Card */}
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle>Muscle Recovery</CardTitle>
                </div>
                <CardDescription>Current recovery status for each muscle group</CardDescription>
              </CardHeader>
              <CardContent>
                {recoveryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !recoveryState ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recovery data available
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Main muscle groups */}
                    <div className="space-y-4">
                      {muscleGroups.map(({ key, label }) => {
                        const recovery = recoveryState[key as keyof RecoveryState];
                        const percentage = Math.min(recovery.recoveryPercentage, 100);
                        
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{label}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${getRecoveryTextColor(percentage)}`}>
                                  {percentage.toFixed(0)}%
                                </span>
                                <Badge 
                                  variant={percentage >= 80 ? 'default' : percentage >= 50 ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {getRecoveryStatus(percentage)}
                                </Badge>
                              </div>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-all duration-500 ${getRecoveryColor(percentage)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Leg subgroups - passive tracking */}
                    <div className="space-y-3 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Leg Muscle Subgroups (Passive Tracking)
                        </span>
                      </div>
                      <div className="space-y-4">
                        {legSubgroups.map(({ key, label }) => {
                          const recovery = recoveryState[key as keyof RecoveryState];
                          const percentage = Math.min(recovery.recoveryPercentage, 100);
                          
                          return (
                            <div key={key} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold ${getRecoveryTextColor(percentage)}`}>
                                    {percentage.toFixed(0)}%
                                  </span>
                                  <Badge 
                                    variant={percentage >= 80 ? 'default' : percentage >= 50 ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    {getRecoveryStatus(percentage)}
                                  </Badge>
                                </div>
                              </div>
                              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full transition-all duration-500 ${getRecoveryColor(percentage)}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly Volume Card */}
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>Weekly Training Volume</CardTitle>
                <CardDescription>Total volume per muscle group this week</CardDescription>
              </CardHeader>
              <CardContent>
                {volumeLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : weeklyVolume.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No training data for this week
                  </div>
                ) : (
                  <div className="space-y-4">
                    {weeklyVolume.map((volume) => {
                      const maxVolume = Math.max(...weeklyVolume.map(v => v.weeklyVolume));
                      const percentage = maxVolume > 0 ? (volume.weeklyVolume / maxVolume) * 100 : 0;
                      
                      return (
                        <div key={volume.muscleGroup} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{volume.muscleGroup}</span>
                            <span className="text-sm font-semibold text-primary">
                              {formatVolume(volume.weeklyVolume)}
                            </span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="shadow-sm border-dashed border-border/50">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span>&gt;80% Ready to train</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span>50-80% Still recovering</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span>&lt;50% Needs more rest</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </PullToRefresh>
  );
}
