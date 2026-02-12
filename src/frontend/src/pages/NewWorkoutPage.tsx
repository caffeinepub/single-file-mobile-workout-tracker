import { useState } from 'react';
import { WorkoutExercise } from '../types';
import { UserProfile } from '../backend';
import { 
  useGenerateFullBodyWorkout, 
  useGenerateUpperBodyWorkout, 
  useGenerateLowerBodyWorkout,
  WorkoutType 
} from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Dumbbell, Loader2 } from 'lucide-react';

interface NewWorkoutPageProps {
  userProfile: UserProfile;
  onBack: () => void;
  onWorkoutGenerated: (workout: WorkoutExercise[], type: WorkoutType) => void;
}

export default function NewWorkoutPage({ userProfile, onBack, onWorkoutGenerated }: NewWorkoutPageProps) {
  const [selectedType, setSelectedType] = useState<WorkoutType | null>(null);
  
  const generateFullBody = useGenerateFullBodyWorkout();
  const generateUpperBody = useGenerateUpperBodyWorkout();
  const generateLowerBody = useGenerateLowerBodyWorkout();

  const handleVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleGenerateWorkout = async (type: WorkoutType) => {
    handleVibrate();
    setSelectedType(type);

    try {
      let workout;
      
      if (type === 'fullBody') {
        workout = await generateFullBody.mutateAsync();
      } else if (type === 'upperBody') {
        workout = await generateUpperBody.mutateAsync();
      } else {
        // Both lowerBody and lowerBodyWithCore use the unified generator
        workout = await generateLowerBody.mutateAsync();
      }
      
      onWorkoutGenerated(workout.exercises, type);
    } catch (error) {
      console.error('Failed to generate workout:', error);
    } finally {
      setSelectedType(null);
    }
  };

  const workoutTypes = [
    {
      type: 'fullBody' as WorkoutType,
      title: 'Full Body',
      description: 'Complete workout targeting all major muscle groups',
      muscleGroups: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'],
      duration: '65-120 min',
      exercises: '10-14 exercises',
    },
    {
      type: 'upperBody' as WorkoutType,
      title: 'Upper Body',
      description: 'Focus on chest, back, shoulders, and arms',
      muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms', 'Core'],
      duration: '55-85 min',
      exercises: '10-14 exercises',
    },
    {
      type: 'lowerBody' as WorkoutType,
      title: 'Lower Body',
      description: 'Leg training session targeting all leg muscle groups',
      muscleGroups: ['Legs'],
      duration: '45-75 min',
      exercises: '8-10 exercises',
    },
  ];

  const isGenerating = generateFullBody.isPending || generateUpperBody.isPending || generateLowerBody.isPending;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="container px-4">
          <div className="flex h-16 items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                handleVibrate();
                onBack();
              }}
              className="h-10 w-10 hover:bg-white/10 active:scale-90 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">New Workout</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Choose Your Workout</h2>
            <p className="text-lg text-muted-foreground">
              Select a workout type based on your recovery status
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
            {workoutTypes.map((workout) => (
              <Card
                key={workout.type}
                className="border-2 border-border/50 transition-all hover:border-primary/50 hover:shadow-glow-primary hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                onClick={() => !isGenerating && handleGenerateWorkout(workout.type)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 shadow-glow-primary">
                        <Dumbbell className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">{workout.title}</CardTitle>
                        <CardDescription className="text-base mt-1">
                          {workout.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {workout.muscleGroups.map((group) => (
                      <Badge key={group} variant="secondary" className="text-sm">
                        {group}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>⏱️ {workout.duration}</span>
                    <span>•</span>
                    <span>💪 {workout.exercises}</span>
                  </div>
                  <Button
                    size="lg"
                    disabled={isGenerating}
                    className="w-full text-lg font-semibold shadow-glow-primary transition-all hover:shadow-glow-primary hover:scale-105 active:scale-95 h-14 rounded-2xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateWorkout(workout.type);
                    }}
                  >
                    {isGenerating && selectedType === workout.type ? (
                      <>
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Workout'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
