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

  const handleVibrate = (duration: number = 10) => {
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
      console.log('Audio play failed:', error);
    }
  };

  const triggerPRCelebration = (pr: PersonalRecord) => {
    setShowPRBanner(true);
    setTimeout(() => setShowPRBanner(false), 4000);
    
    playVictorySound();
    createConfetti();
    handleVibrate(100);
    
    const prType = pr.type === 'oneRepMax' ? 'One-Rep Max' : 'Volume';
    toast.success(`🎉 NEW PR! ${prType} for ${pr.exerciseName}!`, {
      duration: 5000,
    });
  };

  const getMuscleGroupForTransition = (exercise: WorkoutExercise): string => {
    const primaryGroup = exercise.exercise.primaryMuscleGroup;
    
    // For Lower Body workouts, aggregate leg muscle groups into "Legs"
    if (workoutType === 'lowerBody' || workoutType === 'lowerBodyWithCore') {
      const legGroups = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
      if (legGroups.includes(primaryGroup)) {
        return 'Legs';
      }
    }
    
    return primaryGroup;
  };

  const handleCompleteSet = async () => {
    if (!currentLog) return;

    handleVibrate(20);
    
    const weight = parseWeight(currentLog.weight);
    const reps = parseInt(currentLog.reps);
    
    if (isNaN(weight) || isNaN(reps) || reps <= 0) {
      toast.error('Please enter valid weight and reps');
      return;
    }

    // Mark set as completed
    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: prev[currentExerciseIdx].map((log, idx) => 
        idx === currentSetIdx ? { ...log, completed: true } : log
      ),
    }));

    // Show set completed feedback
    setShowSetCompleted(true);
    setTimeout(() => setShowSetCompleted(false), 1000);

    // Check for PR
    const pr = checkForPR(currentExercise.exercise.name, weight, reps);
    if (pr) {
      triggerPRCelebration(pr);
    }

    // Update suggested weight based on performance
    try {
      const newSuggestedWeight = await updateSuggestedWeight.mutateAsync({
        exerciseName: currentExercise.exercise.name,
        weight,
        reps,
      });

      const oldWeight = currentExercise.suggestedWeight;
      if (newSuggestedWeight !== oldWeight) {
        setWorkout(prev => prev.map((ex, idx) =>
          idx === currentExerciseIdx
            ? { ...ex, suggestedWeight: newSuggestedWeight }
            : ex
        ));

        // Update remaining sets with new suggested weight
        setExerciseLogs(prev => ({
          ...prev,
          [currentExerciseIdx]: prev[currentExerciseIdx].map((log, idx) =>
            idx > currentSetIdx && !log.completed
              ? { ...log, weight: formatWeight(newSuggestedWeight) }
              : log
          ),
        }));

        const direction = newSuggestedWeight > oldWeight ? 'up' : 'down';
        setWeightChangeIndicator(direction);
        setTimeout(() => setWeightChangeIndicator(null), 3000);

        const changePercent = Math.abs(((newSuggestedWeight - oldWeight) / oldWeight) * 100).toFixed(1);
        toast.info(
          `Weight adjusted ${direction === 'up' ? '↑' : '↓'} ${changePercent}% for next set`,
          { duration: 3000 }
        );
      }
    } catch (error) {
      console.error('Failed to update suggested weight:', error);
    }

    // Save set configuration for future workouts
    try {
      await saveSetConfig.mutateAsync({
        exerciseName: currentExercise.exercise.name,
        config: {
          weight,
          reps: BigInt(reps),
          sets: BigInt(totalSets),
        },
      });
    } catch (error) {
      console.error('Failed to save set configuration:', error);
    }

    // Check if this was the last set of the exercise
    if (currentSetIdx >= totalSets - 1) {
      // Check if moving to a different muscle group
      if (currentExerciseIdx < workout.length - 1) {
        const currentMuscleGroup = getMuscleGroupForTransition(currentExercise);
        const nextExercise = workout[currentExerciseIdx + 1];
        const nextMuscleGroup = getMuscleGroupForTransition(nextExercise);

        if (currentMuscleGroup !== nextMuscleGroup) {
          setCurrentMuscleGroup(currentMuscleGroup);
          setNextMuscleGroup(nextMuscleGroup);
          setMuscleGroupRestTimer(muscleGroupRestInterval);
          setIsMuscleGroupTimerRunning(true);
          toast.info(`Transitioning from ${currentMuscleGroup} to ${nextMuscleGroup}. Take ${Number(userProfile.muscleGroupRestInterval)} minutes rest.`, {
            duration: 5000,
          });
          return;
        }
      }
      
      // Move to next exercise
      if (currentExerciseIdx < workout.length - 1) {
        setCurrentExerciseIdx(currentExerciseIdx + 1);
        setCurrentSetIdx(0);
        toast.success('Exercise complete! Moving to next exercise.');
      } else {
        // Workout complete
        toast.success('🎉 Workout complete! Great job!', { duration: 5000 });
      }
    } else {
      // Start rest timer for next set
      setRestTimer(defaultRestTime);
      setIsTimerRunning(true);
    }
  };

  const handleAutoAdvance = () => {
    if (currentSetIdx < totalSets - 1) {
      setCurrentSetIdx(currentSetIdx + 1);
    }
  };

  const handleSkipRest = () => {
    handleVibrate(10);
    setIsTimerRunning(false);
    setRestTimer(0);
    handleAutoAdvance();
  };

  const handleSkipMuscleGroupRest = () => {
    handleVibrate(10);
    setIsMuscleGroupTimerRunning(false);
    setMuscleGroupRestTimer(0);
    if (currentExerciseIdx < workout.length - 1) {
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetIdx(0);
    }
  };

  const handlePreviousSet = () => {
    handleVibrate(10);
    if (currentSetIdx > 0) {
      setCurrentSetIdx(currentSetIdx - 1);
    } else if (currentExerciseIdx > 0) {
      setCurrentExerciseIdx(currentExerciseIdx - 1);
      const prevExerciseSets = customSetsCount[currentExerciseIdx - 1] || Number(workout[currentExerciseIdx - 1].sets);
      setCurrentSetIdx(prevExerciseSets - 1);
    }
  };

  const handleNextSet = () => {
    handleVibrate(10);
    if (currentSetIdx < totalSets - 1) {
      setCurrentSetIdx(currentSetIdx + 1);
    } else if (currentExerciseIdx < workout.length - 1) {
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetIdx(0);
    }
  };

  const handleFinishWorkout = async () => {
    handleVibrate(30);
    
    const completedExercises: WorkoutExercise[] = workout.map((ex, idx) => {
      const logs = exerciseLogs[idx] || [];
      const completedSets = logs.filter(log => log.completed);
      
      return {
        ...ex,
        sets: completedSets.length,
        setData: completedSets.map(log => ({
          weight: parseWeight(log.weight),
          reps: parseInt(log.reps),
        })),
      };
    }).filter(ex => ex.sets > 0);

    if (completedExercises.length === 0) {
      toast.error('No sets completed. Cannot save workout.');
      return;
    }

    const totalVolume = completedExercises.reduce((sum, ex) => {
      return sum + ex.setData.reduce((exSum, set) => exSum + (set.weight * set.reps), 0);
    }, 0);

    const workoutData = {
      exercises: completedExercises,
      timestamp: BigInt(Date.now() * 1_000_000),
      totalVolume,
    };

    try {
      await saveWorkoutMutation.mutateAsync(workoutData);
      clearWorkoutSession();
      await clearSetConfigs.mutateAsync();
      playVictorySound();
      createConfetti();
      toast.success('🎉 Workout saved successfully!', { duration: 3000 });
      setTimeout(() => onBack(), 1500);
    } catch (error) {
      console.error('Failed to save workout:', error);
      toast.error('Failed to save workout. Please try again.');
    }
  };

  const handleChangeExercise = () => {
    handleVibrate(10);
    setChangeModalOpen(true);
  };

  const handleExerciseSelected = (newExercise: Exercise) => {
    onExerciseChange(currentExerciseIdx, newExercise);
    
    // Update local workout state
    setWorkout(prev => prev.map((ex, idx) =>
      idx === currentExerciseIdx
        ? {
            ...ex,
            exercise: newExercise,
            suggestedWeight: ex.suggestedWeight,
          }
        : ex
    ));

    // Reset logs for this exercise
    const sets = totalSets;
    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: Array(sets).fill(null).map(() => ({
        weight: formatWeight(workout[currentExerciseIdx].suggestedWeight),
        reps: String(workout[currentExerciseIdx].reps),
        completed: false,
      })),
    }));

    toast.success(`Exercise changed to ${newExercise.name}`);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((currentExerciseIdx * 100 + ((currentSetIdx + 1) / totalSets) * 100) / workout.length);

  if (!currentExercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="container px-4">
          <div className="flex h-16 items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                handleVibrate();
                if (confirm('Are you sure you want to exit? Your progress will be saved.')) {
                  onBack();
                }
              }}
              className="h-10 w-10 hover:bg-white/10 active:scale-90 rounded-2xl tap-target transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 px-4">
              <Progress value={progress} className="h-2" />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Exercise {currentExerciseIdx + 1} of {workout.length}
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleFinishWorkout}
              className="hover:bg-primary/90 active:scale-90 rounded-2xl tap-target transition-all"
            >
              Finish
            </Button>
          </div>
        </div>
      </header>

      {/* PR Banner */}
      {showPRBanner && (
        <div className="fixed top-20 left-0 right-0 z-50 mx-4 animate-in slide-in-from-top">
          <Card className="border-2 border-primary bg-primary/10">
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">🎉</span>
                <span className="text-lg font-bold text-primary">NEW PERSONAL RECORD!</span>
                <span className="text-2xl">🎉</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Set Completed Feedback */}
      {showSetCompleted && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in">
          <div className="rounded-full bg-green-500 p-8">
            <Check className="h-16 w-16 text-white" />
          </div>
        </div>
      )}

      {/* Weight Change Indicator */}
      {weightChangeIndicator && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-right">
          <Badge variant="default" className="text-lg px-4 py-2">
            {weightChangeIndicator === 'up' ? (
              <>
                <TrendingUp className="mr-2 h-5 w-5" />
                Weight Increased
              </>
            ) : (
              <>
                <TrendingDown className="mr-2 h-5 w-5" />
                Weight Decreased
              </>
            )}
          </Badge>
        </div>
      )}

      {/* Muscle Group Rest Timer */}
      {isMuscleGroupTimerRunning && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4 border-2 border-primary">
            <CardContent className="py-8 text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Muscle Group Transition</h2>
                <p className="text-muted-foreground">
                  {currentMuscleGroup} → {nextMuscleGroup}
                </p>
              </div>
              <div className="text-6xl font-bold text-primary">
                {formatTime(muscleGroupRestTimer)}
              </div>
              <div className="space-y-2">
                <Button
                  size="lg"
                  onClick={handleSkipMuscleGroupRest}
                  className="w-full"
                >
                  <SkipForward className="mr-2 h-5 w-5" />
                  Skip Rest
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-32">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Exercise Info */}
          <Card className="border-2 border-border/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{currentExercise.exercise.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{currentExercise.exercise.primaryMuscleGroup}</Badge>
                    <Badge variant="outline">{currentExercise.exercise.equipmentType}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleChangeExercise}
                    className="hover:bg-white/10 active:scale-90 rounded-xl tap-target transition-all"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                  <a
                    href={currentExercise.exercise.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl hover:bg-white/10 active:scale-90 tap-target transition-all"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <span className="text-sm text-muted-foreground">Current Set</span>
                <span className="text-2xl font-bold">
                  {currentSetIdx + 1} / {totalSets}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Set Input */}
          <Card className="border-2 border-primary/50">
            <CardContent className="pt-6 space-y-6">
              {/* Weight Input */}
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-base">Weight ({userProfile.weightUnit})</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('weight')}
                    className="h-12 w-12 rounded-xl tap-target"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={currentLog?.weight || '0'}
                    onChange={(e) => updateCurrentLog('weight', e.target.value)}
                    className="text-center text-2xl font-bold h-14 rounded-xl"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('weight')}
                    className="h-12 w-12 rounded-xl tap-target"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Reps Input */}
              <div className="space-y-2">
                <Label htmlFor="reps" className="text-base">Reps</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('reps')}
                    className="h-12 w-12 rounded-xl tap-target"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                  <Input
                    id="reps"
                    type="number"
                    value={currentLog?.reps || '0'}
                    onChange={(e) => updateCurrentLog('reps', e.target.value)}
                    className="text-center text-2xl font-bold h-14 rounded-xl"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('reps')}
                    className="h-12 w-12 rounded-xl tap-target"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Sets Count */}
              <div className="space-y-2">
                <Label className="text-base">Total Sets</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('sets')}
                    className="h-12 w-12 rounded-xl tap-target"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                  <div className="flex-1 text-center text-2xl font-bold h-14 flex items-center justify-center border border-border rounded-xl">
                    {totalSets}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('sets')}
                    className="h-12 w-12 rounded-xl tap-target"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rest Timer */}
          {isTimerRunning && (
            <Card className="border-2 border-primary">
              <CardContent className="py-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">Rest Time</p>
                <div className="text-5xl font-bold text-primary">
                  {formatTime(restTimer)}
                </div>
                <Button
                  variant="outline"
                  onClick={handleSkipRest}
                  className="w-full"
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip Rest
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Set History */}
          <Card className="border-2 border-border/50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Set History</h3>
              <div className="space-y-2">
                {exerciseLogs[currentExerciseIdx]?.map((log, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      log.completed
                        ? 'bg-green-500/10 border-green-500/50'
                        : idx === currentSetIdx
                        ? 'bg-primary/10 border-primary/50'
                        : 'bg-muted/30 border-border/50'
                    }`}
                  >
                    <span className="font-medium">Set {idx + 1}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {log.weight} {userProfile.weightUnit} × {log.reps} reps
                      </span>
                      {log.completed && <Check className="h-5 w-5 text-green-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/95 backdrop-blur-sm p-4">
        <div className="container mx-auto max-w-2xl flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePreviousSet}
            disabled={currentExerciseIdx === 0 && currentSetIdx === 0}
            className="flex-1 h-14 rounded-2xl tap-target"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Previous
          </Button>
          <Button
            size="lg"
            onClick={handleCompleteSet}
            disabled={!currentLog || currentLog.completed}
            className="flex-[2] h-14 rounded-2xl tap-target shadow-glow-primary"
          >
            <Check className="mr-2 h-6 w-6" />
            Complete Set
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleNextSet}
            disabled={currentExerciseIdx === workout.length - 1 && currentSetIdx === totalSets - 1}
            className="flex-1 h-14 rounded-2xl tap-target"
          >
            Next
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Exercise Change Modal */}
      <ExerciseChangeModal
        open={changeModalOpen}
        onOpenChange={setChangeModalOpen}
        currentExercise={currentExercise.exercise}
        onExerciseSelected={handleExerciseSelected}
      />
    </div>
  );
}
