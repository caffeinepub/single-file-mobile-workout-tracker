import { useState, useEffect } from 'react';
import { WorkoutExercise, Exercise } from '../types';
import { UserProfile } from '../backend';
import { 
  useGenerateFullBodyWorkout, 
  useGenerateUpperBodyWorkout, 
  useGenerateLowerBodyWorkout,
  useIsTestRecoveryModeEnabled,
  WorkoutType 
} from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, RefreshCw, ExternalLink, Loader2, AlertCircle, FlaskConical } from 'lucide-react';
import ExerciseChangeModal from '../components/ExerciseChangeModal';
import { toast } from 'sonner';
import { buildOrderedSections, WorkoutSection } from '../lib/workoutPreviewSections';

interface WorkoutPreviewPageProps {
  userProfile: UserProfile;
  workout: WorkoutExercise[];
  workoutType: WorkoutType;
  onBack: () => void;
  onStartWorkout: () => void;
  onExerciseChange: (index: number, newExercise: Exercise) => void;
}

export default function WorkoutPreviewPage({
  userProfile,
  workout,
  workoutType,
  onBack,
  onStartWorkout,
  onExerciseChange,
}: WorkoutPreviewPageProps) {
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [selectedExerciseIdx, setSelectedExerciseIdx] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const generateFullBody = useGenerateFullBodyWorkout();
  const generateUpperBody = useGenerateUpperBodyWorkout();
  const generateLowerBody = useGenerateLowerBodyWorkout();
  const { data: isTestMode = false } = useIsTestRecoveryModeEnabled();

  // Minimal validation - only check for duplicates and basic structure
  useEffect(() => {
    const validateWorkoutData = () => {
      if (!workout || workout.length === 0) {
        setValidationError('Workout is empty. Please regenerate.');
        return false;
      }

      // Check for duplicate exercises (case-insensitive)
      const exerciseNames = new Map<string, string>();
      for (const ex of workout) {
        if (!ex.exercise || !ex.exercise.name) {
          setValidationError('Invalid exercise data detected. Please regenerate.');
          return false;
        }
        const lowerName = ex.exercise.name.toLowerCase();
        if (exerciseNames.has(lowerName)) {
          setValidationError(`Duplicate exercise detected: ${ex.exercise.name}. Please regenerate.`);
          return false;
        }
        exerciseNames.set(lowerName, ex.exercise.name);
      }

      // Validate each exercise structure
      for (const ex of workout) {
        if (!ex.exercise.primaryMuscleGroup || !ex.exercise.equipmentType || !ex.exercise.demoUrl) {
          setValidationError('Incomplete exercise data. Please regenerate.');
          return false;
        }
        if (ex.sets <= 0 || ex.reps <= 0) {
          setValidationError(`Invalid sets/reps for ${ex.exercise.name}. Please regenerate.`);
          return false;
        }
        if (ex.suggestedWeight < 0) {
          setValidationError(`Invalid weight for ${ex.exercise.name}. Please regenerate.`);
          return false;
        }
      }
      
      setValidationError(null);
      return true;
    };

    validateWorkoutData();
  }, [workout]);

  const handleVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleRegenerate = async () => {
    handleVibrate();
    setValidationError(null);
    try {
      if (workoutType === 'fullBody') {
        await generateFullBody.mutateAsync();
      } else if (workoutType === 'upperBody') {
        await generateUpperBody.mutateAsync();
      } else {
        await generateLowerBody.mutateAsync();
      }
    } catch (error) {
      console.error('Failed to regenerate workout:', error);
      setValidationError('Failed to regenerate workout. Please try again.');
    }
  };

  const handleChangeExercise = (idx: number) => {
    handleVibrate();
    setSelectedExerciseIdx(idx);
    setChangeModalOpen(true);
  };

  const handleExerciseSelected = (newExercise: Exercise) => {
    onExerciseChange(selectedExerciseIdx, newExercise);
    setValidationError(null);
  };

  const handleStartWorkout = () => {
    if (validationError) {
      toast.error('Please fix workout issues before starting');
      return;
    }
    handleVibrate();
    onStartWorkout();
  };

  const formatWeight = (weight: number) => {
    const displayWeight = userProfile.weightUnit === 'kg' 
      ? weight 
      : weight * 2.20462;
    return `${displayWeight.toFixed(1)} ${userProfile.weightUnit}`;
  };

  const getWorkoutTitle = () => {
    switch (workoutType) {
      case 'fullBody':
        return 'Full Body Workout';
      case 'upperBody':
        return 'Upper Body Workout';
      case 'lowerBody':
        return 'Lower Body Workout';
      case 'lowerBodyWithCore':
        return 'Lower Body + Core Workout';
      default:
        return 'Workout';
    }
  };

  const estimatedDuration = () => {
    const totalSets = workout.reduce((sum, ex) => sum + ex.sets, 0);
    const restTime = Number(userProfile.restTime);
    const exerciseTime = 45;
    const totalTime = (totalSets * exerciseTime + (totalSets - 1) * restTime) / 60;
    return Math.round(totalTime);
  };

  // Build ordered sections with enforced muscle group order
  const orderedSections = buildOrderedSections(workout);
  const isRegenerating = generateFullBody.isPending || generateUpperBody.isPending || generateLowerBody.isPending;

  const renderExerciseCard = (ex: WorkoutExercise, idx: number) => (
    <Card key={idx} className="border border-border/50 bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{ex.exercise.name}</CardTitle>
            <CardDescription className="text-sm mt-1">
              {ex.sets} sets × {ex.reps} reps • {formatWeight(ex.suggestedWeight)}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleChangeExercise(idx)}
              className="hover:bg-white/10 active:scale-90 rounded-xl tap-target transition-all hover:shadow-glow-primary"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <a
              href={ex.exercise.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl hover:bg-white/10 active:scale-90 tap-target transition-all hover:shadow-glow-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {ex.exercise.equipmentType}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderSection = (section: WorkoutSection) => {
    // If section has subsections (Legs), render nested structure
    if (section.subsections && section.subsections.length > 0) {
      const totalExercises = section.subsections.reduce(
        (sum, sub) => sum + sub.exercises.length,
        0
      );

      return (
        <Card key={section.name} className="border-2 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default" className="text-base px-3 py-1">
                {section.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.subsections.map((subsection) => (
              <div key={subsection.name} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {subsection.name}
                </h3>
                <div className="space-y-3">
                  {subsection.exercises.map(({ exercise: ex, index: idx }) =>
                    renderExerciseCard(ex, idx)
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    // Standard top-level section
    return (
      <Card key={section.name} className="border-2 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="default" className="text-base px-3 py-1">
              {section.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {section.exercises.length} exercise{section.exercises.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {section.exercises.map(({ exercise: ex, index: idx }) =>
            renderExerciseCard(ex, idx)
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="container px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{getWorkoutTitle()}</h1>
                  {isTestMode && (
                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                      <FlaskConical className="h-3 w-3 mr-1" />
                      Test
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {workout.length} exercises • ~{estimatedDuration()} min
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="hover:bg-white/10 active:scale-90 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
            >
              {isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="mx-auto max-w-2xl space-y-6">
          {validationError && (
            <Card className="border-2 border-destructive/50 bg-destructive/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive mb-3">{validationError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="border-destructive/50 hover:bg-destructive/20"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Try Again
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {orderedSections.map((section) => renderSection(section))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/95 backdrop-blur-sm p-4">
        <div className="container mx-auto max-w-2xl">
          <Button
            size="lg"
            onClick={handleStartWorkout}
            disabled={!!validationError}
            className="w-full text-lg font-semibold shadow-glow-primary transition-all hover:shadow-glow-primary hover:scale-105 active:scale-95 h-14 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="mr-2 h-6 w-6 fill-current" />
            Start Workout
          </Button>
        </div>
      </div>

      {workout[selectedExerciseIdx] && (
        <ExerciseChangeModal
          open={changeModalOpen}
          onOpenChange={setChangeModalOpen}
          currentExercise={workout[selectedExerciseIdx].exercise}
          onExerciseSelected={handleExerciseSelected}
        />
      )}
    </div>
  );
}
