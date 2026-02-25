import { useState, useEffect, useRef } from 'react';
import { useSaveWorkout, useGetWorkoutHistory, useSaveSetConfiguration, useGetSetConfiguration, useClearSetConfigurations, useUpdateSuggestedWeightDuringSession } from '../hooks/useQueries';
import { useWakeLock } from '../hooks/useWakeLock';
import { WorkoutExercise, SetData, Exercise } from '../types';
import { UserProfile } from '../backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Check, ExternalLink, Loader2, SkipForward, Plus, RefreshCw, ChevronUp, ChevronDown, ArrowRight, Eye, EyeOff, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import ExerciseChangeModal from '../components/ExerciseChangeModal';
import { saveWorkoutSession, clearWorkoutSession, loadWorkoutSession } from '../lib/sessionStorage';
import { WorkoutType } from '../hooks/useQueries';

interface WorkoutSessionPageProps {
  userProfile: UserProfile;
  workout: WorkoutExercise[];
  workoutType?: WorkoutType;
  onBack: () => void;
  onExerciseChange: (index: number, newExercise: Exercise) => void;
}

interface ExerciseSetLog {
  weight: string;
  reps: string;
  completed: boolean;
}

interface PersonalRecord {
  exerciseName: string;
  type: 'oneRepMax' | 'totalVolume';
  oldValue: number;
  newValue: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
}

export default function WorkoutSessionPage({ userProfile, workout: initialWorkout, workoutType, onBack, onExerciseChange }: WorkoutSessionPageProps) {
  const [workout, setWorkout] = useState<WorkoutExercise[]>(initialWorkout);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState<number>(0);
  const [currentSetIdx, setCurrentSetIdx] = useState<number>(0);
  const [exerciseLogs, setExerciseLogs] = useState<Record<number, ExerciseSetLog[]>>({});
  const [restTimer, setRestTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [muscleGroupRestTimer, setMuscleGroupRestTimer] = useState<number>(0);
  const [isMuscleGroupTimerRunning, setIsMuscleGroupTimerRunning] = useState<boolean>(false);
  const [currentMuscleGroup, setCurrentMuscleGroup] = useState<string>('');
  const [nextMuscleGroup, setNextMuscleGroup] = useState<string>('');
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [showPRBanner, setShowPRBanner] = useState(false);
  const [showSetCompleted, setShowSetCompleted] = useState(false);
  const [customSetsCount, setCustomSetsCount] = useState<Record<number, number>>({});
  const [sessionRestored, setSessionRestored] = useState(false);
  const [weightChangeIndicator, setWeightChangeIndicator] = useState<'up' | 'down' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const saveWorkoutMutation = useSaveWorkout();
  const { data: workoutHistory = [] } = useGetWorkoutHistory();
  const saveSetConfig = useSaveSetConfiguration();
  const { data: setConfigurations = {} } = useGetSetConfiguration();
  const clearSetConfigs = useClearSetConfigurations();
  const updateSuggestedWeight = useUpdateSuggestedWeightDuringSession();

  // Wake Lock integration with robust status tracking
  const { isLocked, status: wakeLockStatus, requestLock, releaseLock } = useWakeLock();

  const defaultRestTime = Number(userProfile.restTime);
  const muscleGroupRestInterval = Number(userProfile.muscleGroupRestInterval) * 60; // Convert minutes to seconds

  const handleVibrate = (duration: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  };

  // Request wake lock when component mounts
  useEffect(() => {
    const initWakeLock = async () => {
      const success = await requestLock();
      if (success) {
        console.log('✓ Screen wake lock activated - display will stay awake');
      } else if (wakeLockStatus === 'unsupported') {
        toast.info('Screen may sleep during workout. Wake Lock not supported on this device.', {
          duration: 4000,
        });
      } else if (wakeLockStatus === 'error') {
        toast.warning('Could not activate screen wake lock. Screen may dim during workout.', {
          duration: 4000,
        });
      }
    };

    initWakeLock();

    // Release wake lock when component unmounts
    return () => {
      releaseLock();
    };
  }, []);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current) {
        document.body.removeChild(canvasRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = () => {
      const savedSession = loadWorkoutSession();
      if (savedSession && !sessionRestored) {
        console.log('[WorkoutSession] Restoring previous session');
        setCurrentExerciseIdx(savedSession.currentExerciseIdx);
        setCurrentSetIdx(savedSession.currentSetIdx);
        setExerciseLogs(savedSession.exerciseLogs);
        setCustomSetsCount(savedSession.customSetsCount);
        setSessionRestored(true);
        toast.success('Previous workout session restored!', { duration: 3000 });
      }
    };

    restoreSession();
  }, [sessionRestored]);

  useEffect(() => {
    const initializeLogs = () => {
      // Skip initialization if session was restored
      if (sessionRestored) return;

      const initialLogs: Record<number, ExerciseSetLog[]> = {};
      const initialSetsCount: Record<number, number> = {};
      
      for (let idx = 0; idx < workout.length; idx++) {
        const ex = workout[idx];
        const exerciseName = ex.exercise.name;
        
        const savedConfig = setConfigurations[exerciseName];
        
        if (savedConfig) {
          const sets = Number(savedConfig.sets);
          initialSetsCount[idx] = sets;
          initialLogs[idx] = Array(sets).fill(null).map(() => ({
            weight: formatWeight(savedConfig.weight),
            reps: String(savedConfig.reps),
            completed: false,
          }));
        } else {
          const sets = Number(ex.sets);
          initialSetsCount[idx] = sets;
          initialLogs[idx] = Array(sets).fill(null).map(() => ({
            weight: formatWeight(ex.suggestedWeight),
            reps: String(ex.reps),
            completed: false,
          }));
        }
      }
      
      setExerciseLogs(initialLogs);
      setCustomSetsCount(initialSetsCount);
    };

    initializeLogs();
  }, [workout, sessionRestored, setConfigurations]);

  // Save session state whenever it changes
  useEffect(() => {
    if (Object.keys(exerciseLogs).length > 0) {
      saveWorkoutSession({
        workout,
        workoutType: workoutType || 'fullBody',
        currentExerciseIdx,
        currentSetIdx,
        exerciseLogs,
        customSetsCount,
        timestamp: Date.now()
      });
    }
  }, [currentExerciseIdx, currentSetIdx, exerciseLogs, customSetsCount, workout, workoutType]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            handleVibrate(50);
            handleAutoAdvance();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, restTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isMuscleGroupTimerRunning && muscleGroupRestTimer > 0) {
      interval = setInterval(() => {
        setMuscleGroupRestTimer((prev) => {
          if (prev <= 1) {
            setIsMuscleGroupTimerRunning(false);
            handleVibrate(50);
            toast.success('Muscle group rest complete! Ready for next exercise.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMuscleGroupTimerRunning, muscleGroupRestTimer]);

  const formatWeight = (weight: number) => {
    const displayWeight = userProfile.weightUnit === 'kg' 
      ? weight 
      : weight * 2.20462;
    return displayWeight.toFixed(1);
  };

  const parseWeight = (weightStr: string): number => {
    const weight = parseFloat(weightStr);
    if (isNaN(weight)) return 0;
    return userProfile.weightUnit === 'kg' 
      ? weight 
      : weight / 2.20462;
  };

  const currentExercise = workout[currentExerciseIdx];
  const currentLog = exerciseLogs[currentExerciseIdx]?.[currentSetIdx];
  const totalSets = customSetsCount[currentExerciseIdx] || Number(currentExercise?.sets || 0);

  const updateCurrentLog = (field: 'weight' | 'reps', value: string) => {
    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: prev[currentExerciseIdx].map((log, idx) => 
        idx === currentSetIdx ? { ...log, [field]: value } : log
      ),
    }));
  };

  const incrementValue = (field: 'weight' | 'reps' | 'sets') => {
    handleVibrate(5);
    if (field === 'sets') {
      const newCount = totalSets + 1;
      if (newCount > 10) return;
      updateSetsCount(newCount);
    } else {
      const currentValue = field === 'weight' 
        ? parseFloat(currentLog?.weight || '0')
        : parseInt(currentLog?.reps || '0');
      const increment = field === 'weight' ? 2.5 : 1;
      const newValue = currentValue + increment;
      updateCurrentLog(field, newValue.toString());
    }
  };

  const decrementValue = (field: 'weight' | 'reps' | 'sets') => {
    handleVibrate(5);
    if (field === 'sets') {
      const newCount = totalSets - 1;
      if (newCount < 1) return;
      updateSetsCount(newCount);
    } else {
      const currentValue = field === 'weight' 
        ? parseFloat(currentLog?.weight || '0')
        : parseInt(currentLog?.reps || '0');
      const decrement = field === 'weight' ? 2.5 : 1;
      const newValue = Math.max(0, currentValue - decrement);
      updateCurrentLog(field, newValue.toString());
    }
  };

  const updateSetsCount = (newCount: number) => {
    if (newCount < 1 || newCount > 10) return;
    
    const currentLogs = exerciseLogs[currentExerciseIdx] || [];
    const currentLog = currentLogs[currentSetIdx];
    
    const newLogs = Array(newCount).fill(null).map((_, idx) => {
      if (idx < currentLogs.length) {
        return currentLogs[idx];
      } else {
        return {
          weight: currentLog?.weight || formatWeight(currentExercise.suggestedWeight),
          reps: currentLog?.reps || String(currentExercise.reps),
          completed: false,
        };
      }
    });
    
    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: newLogs,
    }));
    
    setCustomSetsCount(prev => ({
      ...prev,
      [currentExerciseIdx]: newCount,
    }));
  };

  const checkForPR = (exerciseName: string, weight: number, reps: number): PersonalRecord | null => {
    const oneRepMax = weight * (1 + reps / 30);
    
    const previousWorkouts = workoutHistory.filter(w => 
      w.exercises.some(ex => ex.exercise.name === exerciseName)
    );
    
    if (previousWorkouts.length === 0) return null;
    
    let previousBestOneRepMax = 0;
    let previousBestVolume = 0;
    
    previousWorkouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        if (ex.exercise.name === exerciseName) {
          ex.setData.forEach(set => {
            const setOneRepMax = set.weight * (1 + set.reps / 30);
            if (setOneRepMax > previousBestOneRepMax) {
              previousBestOneRepMax = setOneRepMax;
            }
            const setVolume = set.weight * set.reps;
            if (setVolume > previousBestVolume) {
              previousBestVolume = setVolume;
            }
          });
        }
      });
    });
    
    if (oneRepMax > previousBestOneRepMax) {
      return {
        exerciseName,
        type: 'oneRepMax',
        oldValue: previousBestOneRepMax,
        newValue: oneRepMax,
      };
    }
    
    const currentVolume = weight * reps;
    if (currentVolume > previousBestVolume) {
      return {
        exerciseName,
        type: 'totalVolume',
        oldValue: previousBestVolume,
        newValue: currentVolume,
      };
    }
    
    return null;
  };

  const createConfetti = () => {
    if (!canvasRef.current) return;

    const colors = ['#4fc3f7', '#ff4081', '#a855f7', '#10b981', '#f59e0b'];
    const particleCount = 100;
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 10 + 5;
      
      newParticles.push({
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        gravity: 0.3 + Math.random() * 0.2,
      });
    }

    particlesRef.current = newParticles;
    animateConfetti();
  };

  const animateConfetti = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      particle.rotation += particle.rotationSpeed;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();

      return particle.y < canvas.height + 50;
    });

    if (particlesRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateConfetti);
    }
  };

  const playVictorySound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();
      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);
      oscillator1.frequency.value = 523.25;
      oscillator1.type = 'sine';
      gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.5);
      
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator2.frequency.value = 659.25;
        oscillator2.type = 'sine';
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.5);
      }, 150);
    } catch (error) {
      console.error('Error playing victory sound:', error);
    }
  };

  const completeSet = async () => {
    if (!currentLog) return;

    handleVibrate(20);
    
    const weight = parseWeight(currentLog.weight);
    const reps = parseInt(currentLog.reps);
    const exerciseName = currentExercise.exercise.name;
    
    const pr = checkForPR(exerciseName, weight, reps);
    if (pr) {
      setShowPRBanner(true);
      createConfetti();
      playVictorySound();
      handleVibrate([50, 100, 50]);
      toast.success(`🎉 New PR! ${pr.type === 'oneRepMax' ? 'One Rep Max' : 'Volume'} record!`, {
        duration: 5000,
      });
      setTimeout(() => setShowPRBanner(false), 5000);
    }

    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: prev[currentExerciseIdx].map((log, idx) => 
        idx === currentSetIdx ? { ...log, completed: true } : log
      ),
    }));

    setShowSetCompleted(true);
    setTimeout(() => setShowSetCompleted(false), 1500);

    const oldWeight = currentExercise.suggestedWeight;
    const newSuggestedWeight = await updateSuggestedWeight.mutateAsync({
      exerciseName,
      newWeight: weight,
    });

    if (newSuggestedWeight !== oldWeight) {
      setWorkout(prev => prev.map((ex, idx) =>
        idx === currentExerciseIdx ? { ...ex, suggestedWeight: newSuggestedWeight } : ex
      ));

      setExerciseLogs(prev => ({
        ...prev,
        [currentExerciseIdx]: prev[currentExerciseIdx].map((log, idx) =>
          !log.completed
            ? { ...log, weight: formatWeight(newSuggestedWeight) }
            : log
        ),
      }));

      const direction = newSuggestedWeight > oldWeight ? 'up' : 'down';
      setWeightChangeIndicator(direction);
      setTimeout(() => setWeightChangeIndicator(null), 2000);

      const changePercent = Math.abs(((newSuggestedWeight - oldWeight) / oldWeight) * 100).toFixed(1);
      toast.info(
        `Weight ${direction === 'up' ? 'increased' : 'decreased'} by ${changePercent}% for remaining sets`,
        { duration: 3000 }
      );
    }

    if (currentSetIdx < totalSets - 1) {
      setRestTimer(defaultRestTime);
      setIsTimerRunning(true);
    } else {
      saveSetConfig.mutate({
        exerciseName,
        config: {
          weight,
          reps: BigInt(reps),
          sets: BigInt(totalSets),
        },
      });

      if (currentExerciseIdx < workout.length - 1) {
        const nextExercise = workout[currentExerciseIdx + 1];
        const nextGroup = nextExercise.exercise.primaryMuscleGroup;
        const currentGroup = currentExercise.exercise.primaryMuscleGroup;

        const isLowerBodyWorkout = workoutType === 'lowerBody' || workoutType === 'lowerBodyWithCore';
        const legSubgroups = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
        const isCurrentLegSubgroup = legSubgroups.includes(currentGroup);
        const isNextLegSubgroup = legSubgroups.includes(nextGroup);

        if (isLowerBodyWorkout && isCurrentLegSubgroup && !isNextLegSubgroup) {
          setCurrentMuscleGroup('Legs');
          setNextMuscleGroup(nextGroup);
          setMuscleGroupRestTimer(muscleGroupRestInterval);
          setIsMuscleGroupTimerRunning(true);
          toast.info(`Transitioning from Legs to ${nextGroup}. Take ${muscleGroupRestInterval / 60} minutes rest.`, {
            duration: 5000,
          });
        } else if (currentGroup !== nextGroup && !isCurrentLegSubgroup && !isNextLegSubgroup) {
          setCurrentMuscleGroup(currentGroup);
          setNextMuscleGroup(nextGroup);
          setMuscleGroupRestTimer(muscleGroupRestInterval);
          setIsMuscleGroupTimerRunning(true);
          toast.info(`Transitioning from ${currentGroup} to ${nextGroup}. Take ${muscleGroupRestInterval / 60} minutes rest.`, {
            duration: 5000,
          });
        } else {
          setCurrentExerciseIdx(currentExerciseIdx + 1);
          setCurrentSetIdx(0);
        }
      } else {
        toast.success('Workout complete! Great job! 🎉', { duration: 5000 });
      }
    }
  };

  const handleAutoAdvance = () => {
    if (currentSetIdx < totalSets - 1) {
      setCurrentSetIdx(currentSetIdx + 1);
    }
  };

  const skipSet = () => {
    handleVibrate(10);
    if (currentSetIdx < totalSets - 1) {
      setCurrentSetIdx(currentSetIdx + 1);
      setIsTimerRunning(false);
      setRestTimer(0);
    } else if (currentExerciseIdx < workout.length - 1) {
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetIdx(0);
      setIsTimerRunning(false);
      setRestTimer(0);
    }
  };

  const skipExercise = () => {
    handleVibrate(10);
    if (currentExerciseIdx < workout.length - 1) {
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetIdx(0);
      setIsTimerRunning(false);
      setRestTimer(0);
    }
  };

  const skipMuscleGroupRest = () => {
    handleVibrate(10);
    setIsMuscleGroupTimerRunning(false);
    setMuscleGroupRestTimer(0);
    setCurrentExerciseIdx(currentExerciseIdx + 1);
    setCurrentSetIdx(0);
  };

  const finishWorkout = async () => {
    handleVibrate(30);
    
    const completedExercises: WorkoutExercise[] = [];
    
    for (let idx = 0; idx < workout.length; idx++) {
      const ex = workout[idx];
      const logs = exerciseLogs[idx] || [];
      const completedSets = logs.filter(log => log.completed);
      
      if (completedSets.length > 0) {
        const setData: SetData[] = completedSets.map(log => ({
          weight: parseWeight(log.weight),
          reps: parseInt(log.reps),
        }));
        
        completedExercises.push({
          ...ex,
          sets: completedSets.length,
          setData,
        });
      }
    }
    
    if (completedExercises.length === 0) {
      toast.error('No sets completed. Cannot save workout.');
      return;
    }
    
    const totalVolume = completedExercises.reduce((sum, ex) => {
      return sum + ex.setData.reduce((exSum, set) => exSum + (set.weight * set.reps), 0);
    }, 0);
    
    const workoutData = {
      exercises: completedExercises,
      timestamp: BigInt(Date.now()),
      totalVolume,
    };
    
    try {
      await saveWorkoutMutation.mutateAsync(workoutData);
      clearWorkoutSession();
      clearSetConfigs.mutate();
      createConfetti();
      playVictorySound();
      handleVibrate([50, 100, 50, 100, 50]);
      toast.success('Workout saved successfully! 🎉', { duration: 3000 });
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error('Failed to save workout:', error);
      toast.error('Failed to save workout. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((currentExerciseIdx * totalSets + currentSetIdx + 1) / (workout.reduce((sum, ex, idx) => sum + (customSetsCount[idx] || Number(ex.sets)), 0))) * 100;

  if (!currentExercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (isMuscleGroupTimerRunning) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-2 border-primary/30 shadow-glow-primary">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <Badge variant="outline" className="mb-4 text-lg px-4 py-2">
                Muscle Group Transition
              </Badge>
              <h2 className="text-3xl font-bold mb-2">Rest Period</h2>
              <p className="text-muted-foreground text-lg">
                {currentMuscleGroup} → {nextMuscleGroup}
              </p>
            </div>

            <div className="mb-8">
              <div className="text-8xl font-bold text-primary mb-4">
                {formatTime(muscleGroupRestTimer)}
              </div>
              <Progress value={(1 - muscleGroupRestTimer / muscleGroupRestInterval) * 100} className="h-3" />
            </div>

            <div className="space-y-3">
              <Button
                onClick={skipMuscleGroupRest}
                variant="outline"
                size="lg"
                className="w-full text-lg h-14"
              >
                <SkipForward className="mr-2 h-5 w-5" />
                Skip Rest
              </Button>
              <Button
                onClick={onBack}
                variant="ghost"
                size="lg"
                className="w-full text-lg h-14"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                End Workout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Exit
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {currentExerciseIdx + 1} / {workout.length}
            </Badge>
            {wakeLockStatus === 'active' && (
              <Badge variant="outline" className="text-sm bg-primary/10 text-primary border-primary/30">
                <Eye className="mr-1 h-3 w-3" />
                Awake
              </Badge>
            )}
          </div>
        </div>
        <Progress value={progress} className="h-2 rounded-none" />
      </div>

      {showPRBanner && (
        <div className="fixed top-20 left-0 right-0 z-50 mx-4 animate-in slide-in-from-top">
          <Card className="border-2 border-primary bg-primary/10 shadow-glow-primary">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">🎉 NEW PERSONAL RECORD! 🎉</p>
            </CardContent>
          </Card>
        </div>
      )}

      {showSetCompleted && (
        <div className="fixed top-20 left-0 right-0 z-50 mx-4 animate-in slide-in-from-top">
          <Card className="border-2 border-accent bg-accent/10">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-accent flex items-center justify-center gap-2">
                <Check className="h-6 w-6" />
                Set Completed!
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {weightChangeIndicator && (
        <div className="fixed top-20 left-0 right-0 z-50 mx-4 animate-in slide-in-from-top">
          <Card className="border-2 border-primary/30 bg-background/95">
            <CardContent className="p-4 text-center">
              <p className="text-lg font-semibold flex items-center justify-center gap-2">
                {weightChangeIndicator === 'up' ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-green-500">Weight Increased</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-orange-500" />
                    <span className="text-orange-500">Weight Decreased</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <main className="flex-1 p-6 pb-32">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="border-2 border-primary/30 shadow-glow-primary">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <Badge variant="outline" className="mb-2">
                    {currentExercise.exercise.primaryMuscleGroup}
                  </Badge>
                  <h2 className="text-3xl font-bold">{currentExercise.exercise.name}</h2>
                  <p className="mt-2 text-muted-foreground">
                    {currentExercise.exercise.equipmentType}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(currentExercise.exercise.demoUrl, '_blank')}
                  className="shrink-0"
                >
                  <ExternalLink className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Set</p>
                  <p className="text-3xl font-bold">
                    {currentSetIdx + 1} / {totalSets}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangeModalOpen(true)}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Change
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border/50">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="weight" className="text-lg font-semibold">
                      Weight ({userProfile.weightUnit})
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('weight')}
                        disabled={!currentLog}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('weight')}
                        disabled={!currentLog}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={currentLog?.weight || '0'}
                    onChange={(e) => updateCurrentLog('weight', e.target.value)}
                    className="text-2xl font-bold text-center h-16"
                    disabled={!currentLog}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reps" className="text-lg font-semibold">
                      Reps
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('reps')}
                        disabled={!currentLog}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('reps')}
                        disabled={!currentLog}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="reps"
                    type="number"
                    value={currentLog?.reps || '0'}
                    onChange={(e) => updateCurrentLog('reps', e.target.value)}
                    className="text-2xl font-bold text-center h-16"
                    disabled={!currentLog}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">
                      Total Sets
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('sets')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <span className="flex items-center justify-center w-12 text-xl font-bold">
                        {totalSets}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('sets')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {exerciseLogs[currentExerciseIdx]?.map((log, idx) => (
                  <Button
                    key={idx}
                    variant={log.completed ? 'default' : idx === currentSetIdx ? 'outline' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (!log.completed) {
                        setCurrentSetIdx(idx);
                        handleVibrate(5);
                      }
                    }}
                    className={`h-12 ${log.completed ? 'bg-primary text-primary-foreground' : ''} ${idx === currentSetIdx ? 'border-2 border-primary' : ''}`}
                    disabled={log.completed}
                  >
                    {log.completed ? <Check className="h-5 w-5" /> : idx + 1}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {isTimerRunning && (
            <Card className="border-2 border-accent/30 shadow-glow-accent">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Rest Timer</p>
                <p className="text-6xl font-bold text-accent mb-4">{formatTime(restTimer)}</p>
                <Progress value={(1 - restTimer / defaultRestTime) * 100} className="h-2" />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            <Button
              onClick={completeSet}
              disabled={!currentLog || currentLog.completed}
              size="lg"
              className="w-full text-xl font-bold h-16 shadow-glow-primary"
            >
              <Check className="mr-2 h-6 w-6" />
              Complete Set
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={skipSet}
                variant="outline"
                size="lg"
                className="h-14"
              >
                <SkipForward className="mr-2 h-5 w-5" />
                Skip Set
              </Button>
              <Button
                onClick={skipExercise}
                variant="outline"
                size="lg"
                className="h-14"
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Skip Exercise
              </Button>
            </div>

            <Button
              onClick={finishWorkout}
              variant="secondary"
              size="lg"
              disabled={saveWorkoutMutation.isPending}
              className="w-full h-14"
            >
              {saveWorkoutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Finish Workout
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      <ExerciseChangeModal
        open={changeModalOpen}
        onOpenChange={setChangeModalOpen}
        currentExercise={currentExercise.exercise}
        onExerciseSelected={(newExercise) => {
          onExerciseChange(currentExerciseIdx, newExercise);
          setChangeModalOpen(false);
        }}
      />
    </div>
  );
}
