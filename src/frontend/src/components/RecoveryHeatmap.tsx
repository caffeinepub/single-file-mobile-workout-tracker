import { useGetRecoveryState } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import type { MuscleRecovery } from '../types';

interface RecoveryHeatmapProps {
  legSubgroupRecovery?: {
    quads: MuscleRecovery;
    hamstrings: MuscleRecovery;
    glutes: MuscleRecovery;
    calves: MuscleRecovery;
  } | null;
  legSubgroupLoading?: boolean;
  useWeightedLegAvg?: boolean;
}

export default function RecoveryHeatmap({ 
  legSubgroupRecovery, 
  legSubgroupLoading = false,
  useWeightedLegAvg = false 
}: RecoveryHeatmapProps) {
  const { data: recoveryState, isLoading } = useGetRecoveryState();

  const getRecoveryColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getRecoveryBadge = (percentage: number) => {
    if (percentage >= 80) return { variant: 'default' as const, text: 'Ready' };
    if (percentage >= 60) return { variant: 'secondary' as const, text: 'Moderate' };
    if (percentage >= 40) return { variant: 'outline' as const, text: 'Low' };
    return { variant: 'destructive' as const, text: 'Recovering' };
  };

  const calculateWeightedLegAverage = () => {
    if (!legSubgroupRecovery) return null;
    
    const weighted = 
      0.35 * legSubgroupRecovery.quads.recoveryPercentage +
      0.30 * legSubgroupRecovery.glutes.recoveryPercentage +
      0.20 * legSubgroupRecovery.hamstrings.recoveryPercentage +
      0.15 * legSubgroupRecovery.calves.recoveryPercentage;
    
    return Math.round(weighted);
  };

  if (isLoading) {
    return (
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
    );
  }

  if (!recoveryState) {
    return (
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle>Muscle Recovery</CardTitle>
          <CardDescription>Track your muscle group recovery status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Activity className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-base text-muted-foreground">
              No recovery data available. Complete a workout to start tracking!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const muscleGroups = [
    { name: 'Chest', recovery: recoveryState.chest },
    { name: 'Back', recovery: recoveryState.back },
    { name: 'Shoulders', recovery: recoveryState.shoulders },
    { name: 'Arms', recovery: recoveryState.arms },
    { name: 'Legs', recovery: recoveryState.legs },
    { name: 'Core', recovery: recoveryState.core },
  ];

  // Calculate weighted leg average if feature flag is enabled and data is available
  const displayLegPercentage = useWeightedLegAvg && legSubgroupRecovery && !legSubgroupLoading
    ? calculateWeightedLegAverage() ?? recoveryState.legs.recoveryPercentage
    : recoveryState.legs.recoveryPercentage;

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Muscle Recovery
        </CardTitle>
        <CardDescription>Track your muscle group recovery status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {muscleGroups.map((group) => {
            const percentage = group.name === 'Legs' ? displayLegPercentage : group.recovery.recoveryPercentage;
            const badge = getRecoveryBadge(percentage);
            const colorClass = getRecoveryColor(percentage);

            return (
              <div key={group.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{group.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${colorClass}`}>
                      {Math.round(percentage)}%
                    </span>
                    <Badge variant={badge.variant} className="text-xs">
                      {badge.text}
                    </Badge>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-500 ${
                      percentage >= 80
                        ? 'bg-green-500'
                        : percentage >= 60
                        ? 'bg-yellow-500'
                        : percentage >= 40
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                {/* Display leg subgroup recovery percentages below Legs */}
                {group.name === 'Legs' && legSubgroupRecovery && !legSubgroupLoading && (
                  <div className="ml-4 mt-2 space-y-1.5 border-l-2 border-border/50 pl-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Quads</span>
                      <span className={`font-medium ${getRecoveryColor(legSubgroupRecovery.quads.recoveryPercentage)}`}>
                        {Math.round(legSubgroupRecovery.quads.recoveryPercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Glutes</span>
                      <span className={`font-medium ${getRecoveryColor(legSubgroupRecovery.glutes.recoveryPercentage)}`}>
                        {Math.round(legSubgroupRecovery.glutes.recoveryPercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Hamstrings</span>
                      <span className={`font-medium ${getRecoveryColor(legSubgroupRecovery.hamstrings.recoveryPercentage)}`}>
                        {Math.round(legSubgroupRecovery.hamstrings.recoveryPercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Calves</span>
                      <span className={`font-medium ${getRecoveryColor(legSubgroupRecovery.calves.recoveryPercentage)}`}>
                        {Math.round(legSubgroupRecovery.calves.recoveryPercentage)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
