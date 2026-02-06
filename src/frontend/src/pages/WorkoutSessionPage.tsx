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
  const getSetConfig = useGetSetConfiguration();
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
    const initializeLogs = async () => {
      // Skip initialization if session was restored
      if (sessionRestored) return;

      const initialLogs: Record<number, ExerciseSetLog[]> = {};
      const initialSetsCount: Record<number, number> = {};
      
      for (let idx = 0; idx < workout.length; idx++) {
        const ex = workout[idx];
        const exerciseName = ex.exercise.name;
        
        try {
          const savedConfig = await getSetConfig.mutateAsync(exerciseName);
          
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
        } catch (error) {
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
  }, [workout, sessionRestored]);

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
    if (workoutType === 'lowerBody') {
      const legGroups = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
      if (legGroups.includes(primaryGroup)) {
        return 'Legs';
      }
    }
    
    return primaryGroup;
  };

  const checkMuscleGroupTransition = (currentIdx: number, nextIdx: number): boolean => {
    if (nextIdx >= workout.length) return false;
    
    const currentGroup = getMuscleGroupForTransition(workout[currentIdx]).toLowerCase();
    const nextGroup = getMuscleGroupForTransition(workout[nextIdx]).toLowerCase();
    
    return currentGroup !== nextGroup;
  };

  const handleLogSet = async () => {
    if (!currentLog) return;

    const weight = parseFloat(currentLog.weight);
    const reps = parseInt(currentLog.reps);

    if (isNaN(weight) || weight <= 0) {
      toast.error('Please enter a valid weight');
      return;
    }
    if (isNaN(reps) || reps <= 0) {
      toast.error('Please enter valid reps');
      return;
    }

    // Call backend to update suggested weight based on performance
    try {
      const weightInKg = parseWeight(currentLog.weight);
      const newSuggestedWeight = await updateSuggestedWeight.mutateAsync({
        exerciseName: currentExercise.exercise.name,
        weight: weightInKg,
        reps: reps,
      });

      // Update the workout state with new suggested weight
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

        // Show visual feedback
        const direction = newSuggestedWeight > oldWeight ? 'up' : 'down';
        setWeightChangeIndicator(direction);
        setTimeout(() => setWeightChangeIndicator(null), 2000);

        const changePercent = Math.abs(((newSuggestedWeight - oldWeight) / oldWeight) * 100).toFixed(1);
        const message = direction === 'up' 
          ? `💪 Weight increased by ${changePercent}%!`
          : `⚡ Weight adjusted by ${changePercent}%`;
        
        toast.success(message, { duration: 3000 });
      }
    } catch (error) {
      console.log('Failed to update suggested weight:', error);
      // Continue with set logging even if weight update fails
    }

    try {
      await saveSetConfig.mutateAsync({
        exerciseName: currentExercise.exercise.name,
        config: {
          weight: parseWeight(currentLog.weight),
          reps: BigInt(reps),
          sets: BigInt(totalSets),
        },
      });
    } catch (error) {
      console.log('Failed to save set configuration:', error);
    }

    const pr = checkForPR(currentExercise.exercise.name, parseWeight(currentLog.weight), reps);
    if (pr) {
      triggerPRCelebration(pr);
    }

    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: prev[currentExerciseIdx].map((log, idx) => 
        idx === currentSetIdx ? { ...log, completed: true } : log
      ),
    }));

    handleVibrate(20);

    setShowSetCompleted(true);
    setTimeout(() => {
      setShowSetCompleted(false);
      
      // Check if this is the last set of the current exercise
      if (currentSetIdx === totalSets - 1) {
        // Check if we're transitioning to a new muscle group
        if (currentExerciseIdx < workout.length - 1 && checkMuscleGroupTransition(currentExerciseIdx, currentExerciseIdx + 1)) {
          setCurrentMuscleGroup(getMuscleGroupForTransition(workout[currentExerciseIdx]));
          setNextMuscleGroup(getMuscleGroupForTransition(workout[currentExerciseIdx + 1]));
          setMuscleGroupRestTimer(muscleGroupRestInterval);
          setIsMuscleGroupTimerRunning(true);
          toast.success(`Muscle group complete! ${Number(userProfile.muscleGroupRestInterval)} minute rest before next group.`);
        } else {
          setRestTimer(defaultRestTime);
          setIsTimerRunning(true);
        }
      } else {
        setRestTimer(defaultRestTime);
        setIsTimerRunning(true);
      }
    }, 1000);
  };

  const handleAutoAdvance = () => {
    if (currentSetIdx < totalSets - 1) {
      setCurrentSetIdx(currentSetIdx + 1);
      toast.success('Rest complete! Ready for next set.');
    } else if (currentExerciseIdx < workout.length - 1) {
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetIdx(0);
      toast.success('Exercise complete! Moving to next exercise.');
    } else {
      toast.success('Workout complete! Great job!');
    }
  };

  const handleNextExercise = () => {
    if (currentExerciseIdx < workout.length - 1) {
      handleVibrate();
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetIdx(0);
      setRestTimer(0);
      setIsTimerRunning(false);
      setMuscleGroupRestTimer(0);
      setIsMuscleGroupTimerRunning(false);
    }
  };

  const handleSkipRest = () => {
    handleVibrate();
    setRestTimer(0);
    setIsTimerRunning(false);
    handleAutoAdvance();
  };

  const handleSkipMuscleGroupRest = () => {
    handleVibrate();
    setMuscleGroupRestTimer(0);
    setIsMuscleGroupTimerRunning(false);
    toast.success('Muscle group rest skipped!');
  };

  const addTime = () => {
    handleVibrate();
    setRestTimer(prev => prev + 30);
  };

  const addMuscleGroupTime = () => {
    handleVibrate();
    setMuscleGroupRestTimer(prev => prev + 60);
  };

  const handleChangeClick = () => {
    handleVibrate();
    setChangeModalOpen(true);
  };

  const handleExerciseSelected = (newExercise: Exercise) => {
    onExerciseChange(currentExerciseIdx, newExercise);
    const sets = Number(currentExercise.sets);
    const newLogs = Array(sets).fill(null).map(() => ({
      weight: formatWeight(currentExercise.suggestedWeight),
      reps: String(currentExercise.reps),
      completed: false,
    }));
    setExerciseLogs(prev => ({
      ...prev,
      [currentExerciseIdx]: newLogs,
    }));
    setCustomSetsCount(prev => ({
      ...prev,
      [currentExerciseIdx]: sets,
    }));
    setCurrentSetIdx(0);
    setRestTimer(0);
    setIsTimerRunning(false);
    setMuscleGroupRestTimer(0);
    setIsMuscleGroupTimerRunning(false);
  };

  const handleDone = async () => {
    handleVibrate(30);

    let totalVolume = 0;
    const exercisesWithData = workout.map((ex, idx) => {
      const logs = exerciseLogs[idx] || [];
      const setData: SetData[] = logs
        .filter(log => log.completed)
        .map(log => {
          const weight = parseWeight(log.weight);
          const reps = parseInt(log.reps) || 0;
          totalVolume += weight * reps;
          return { weight, reps };
        });

      return {
        ...ex,
        setData,
      };
    });

    const workoutData = {
      exercises: exercisesWithData,
      timestamp: BigInt(Date.now() * 1_000_000),
      totalVolume,
    };

    try {
      await saveWorkoutMutation.mutateAsync(workoutData);
      
      try {
        await clearSetConfigs.mutateAsync();
      } catch (error) {
        console.log('Failed to clear set configurations:', error);
      }

      // Clear session storage after successful save
      clearWorkoutSession();

      handleVibrate(50);
      toast.success('🎉 Workout saved successfully!', {
        duration: 3000,
      });
      
      // Release wake lock before navigating back
      await releaseLock();
      
      onBack();
    } catch (error) {
      toast.error('Failed to save workout. Please try again.');
      console.error('Workout save error:', error);
    }
  };

  const totalCompletedSets = Object.values(exerciseLogs).reduce(
    (sum, logs) => sum + logs.filter(log => log.completed).length,
    0
  );
  const totalAllSets = Object.values(customSetsCount).reduce((sum, count) => sum + count, 0) || 
                       workout.reduce((sum, ex) => sum + Number(ex.sets), 0);
  const progressPercent = totalAllSets > 0 ? (totalCompletedSets / totalAllSets) * 100 : 0;

  const isLastSet = currentExerciseIdx === workout.length - 1 && currentSetIdx === totalSets - 1;
  const allSetsCompleted = totalCompletedSets === totalAllSets;

  if (!currentExercise) {
    return null;
  }

  const timerProgress = defaultRestTime > 0 ? ((defaultRestTime - restTimer) / defaultRestTime) * 100 : 0;
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference - (timerProgress / 100) * circumference;

  const muscleGroupTimerProgress = muscleGroupRestInterval > 0 ? ((muscleGroupRestInterval - muscleGroupRestTimer) / muscleGroupRestInterval) * 100 : 0;
  const muscleGroupStrokeDashoffset = circumference - (muscleGroupTimerProgress / 100) * circumference;

  // Determine wake lock indicator display
  const getWakeLockIndicator = () => {
    if (wakeLockStatus === 'unsupported') {
      return null; // Don't show anything if unsupported
    }

    if (isLocked) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30">
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Screen kept awake</span>
        </div>
      );
    }

    if (wakeLockStatus === 'error' || wakeLockStatus === 'released') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30">
          <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-xs font-semibold text-yellow-500">Screen may sleep</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {showPRBanner && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[10001] animate-in slide-in-from-top duration-500">
          <div className="bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground px-8 py-4 rounded-full shadow-glow-primary border-4 border-background">
            <p className="text-3xl font-black tracking-wider">🎉 NEW PR! 🎉</p>
          </div>
        </div>
      )}

      {showSetCompleted && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary shadow-glow-primary">
              <Check className="h-20 w-20 text-primary-foreground" />
            </div>
            <p className="text-4xl font-bold text-primary">Set Completed ✓</p>
          </div>
        </div>
      )}

      {/* Weight Change Indicator */}
      {weightChangeIndicator && (
        <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-[10001] animate-in slide-in-from-top duration-300">
          <div className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-glow-primary border-2 ${
            weightChangeIndicator === 'up' 
              ? 'bg-green-500/20 border-green-500/50 text-green-400' 
              : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}>
            {weightChangeIndicator === 'up' ? (
              <TrendingUp className="h-6 w-6" />
            ) : (
              <TrendingDown className="h-6 w-6" />
            )}
            <span className="text-lg font-bold">
              {weightChangeIndicator === 'up' ? 'Weight Increased!' : 'Weight Adjusted'}
            </span>
          </div>
        </div>
      )}

      {/* Full-Screen Muscle Group Rest Timer Modal */}
      {isMuscleGroupTimerRunning && muscleGroupRestTimer > 0 && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0F0F0F] animate-in fade-in duration-300">
          <div className="flex flex-col items-center justify-center w-full h-full px-6 py-12 space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-primary">Muscle Group Transition</h2>
              <p className="text-xl text-muted-foreground">Rest before next muscle group</p>
            </div>

            <div className="flex items-center justify-center gap-8">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Current</p>
                <Badge variant="default" className="text-2xl px-6 py-3 bg-primary/20 text-primary border-primary/30">
                  {currentMuscleGroup}
                </Badge>
              </div>
              
              <ArrowRight className="h-12 w-12 text-primary animate-pulse" />
              
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Next</p>
                <Badge variant="default" className="text-2xl px-6 py-3 bg-primary/20 text-primary border-primary/30">
                  {nextMuscleGroup}
                </Badge>
              </div>
            </div>
            
            <div className="relative">
              <svg className="transform -rotate-90" width="320" height="320">
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  stroke="#229ED9"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={muscleGroupStrokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear drop-shadow-[0_0_10px_rgba(34,158,217,0.5)]"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl font-black tabular-nums">
                    {Math.floor(muscleGroupRestTimer / 60)}:{String(muscleGroupRestTimer % 60).padStart(2, '0')}
                  </div>
                  <div className="text-xl text-muted-foreground mt-2 font-semibold">Rest Time</div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 w-full max-w-md">
              <Button
                variant="outline"
                size="lg"
                onClick={addMuscleGroupTime}
                className="flex-1 h-16 text-lg font-bold bg-white/5 border-white/20 hover:bg-white/10 active:scale-95 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
              >
                <Plus className="mr-2 h-6 w-6" />
                +1 min
              </Button>
              <Button
                variant="default"
                size="lg"
                onClick={handleSkipMuscleGroupRest}
                className="flex-1 h-16 text-lg font-bold bg-primary hover:bg-primary/90 active:scale-95 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
              >
                Skip Rest
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="container px-4">
          <div className="flex h-16 items-center justify-between">
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
            <div className="flex-1 px-4">
              <div className="flex items-center justify-between text-sm mb-1.5 text-muted-foreground">
                <span>Exercise {currentExerciseIdx + 1} of {workout.length}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5 bg-white/10" />
            </div>
            {getWakeLockIndicator()}
            <Button
              onClick={handleDone}
              disabled={saveWorkoutMutation.isPending}
              variant="default"
              size="default"
              className="h-10 px-5 text-sm bg-primary hover:bg-primary/90 active:scale-90 rounded-2xl tap-target transition-all hover:shadow-glow-primary ml-2"
            >
              {saveWorkoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Done'
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-2xl px-4 py-6">
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tight">
              {currentExercise.exercise.name}
            </h1>
            <p className="text-4xl md:text-5xl font-bold text-primary">
              Set {currentSetIdx + 1} of {totalSets}
            </p>
          </div>

          {restTimer > 0 && !isMuscleGroupTimerRunning ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              <div className="relative">
                <svg className="transform -rotate-90" width="320" height="320">
                  <circle
                    cx="160"
                    cy="160"
                    r="140"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="160"
                    cy="160"
                    r="140"
                    stroke="#4fc3f7"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear drop-shadow-[0_0_10px_rgba(79,195,247,0.5)]"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-8xl font-black tabular-nums">
                      {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
                    </div>
                    <div className="text-xl text-muted-foreground mt-2 font-semibold">Rest Time</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 w-full max-w-md">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={addTime}
                  className="flex-1 h-16 text-lg font-bold bg-white/5 border-white/20 hover:bg-white/10 active:scale-95 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
                >
                  <Plus className="mr-2 h-6 w-6" />
                  +30s
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleSkipRest}
                  className="flex-1 h-16 text-lg font-bold bg-primary hover:bg-primary/90 active:scale-95 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
                >
                  Skip Rest
                </Button>
              </div>
            </div>
          ) : !isMuscleGroupTimerRunning && (
            <>
              {currentLog && !currentLog.completed && (
                <div className="space-y-6 py-8">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="weight" className="text-lg font-bold text-muted-foreground">
                        Weight ({userProfile.weightUnit})
                      </Label>
                      <div className="relative">
                        <Input
                          id="weight"
                          type="text"
                          inputMode="decimal"
                          value={currentLog.weight}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              updateCurrentLog('weight', value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || parseFloat(value) === 0) {
                              updateCurrentLog('weight', '0');
                            }
                          }}
                          className="h-20 text-3xl text-center font-bold bg-white/5 border-white/20 rounded-2xl pr-10 transition-all focus:shadow-glow-primary"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => incrementValue('weight')}
                            className="tap-target flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all hover:shadow-glow-primary"
                          >
                            <ChevronUp className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => decrementValue('weight')}
                            className="tap-target flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all hover:shadow-glow-primary"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="reps" className="text-lg font-bold text-muted-foreground">
                        Reps
                      </Label>
                      <div className="relative">
                        <Input
                          id="reps"
                          type="text"
                          inputMode="numeric"
                          value={currentLog.reps}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d+$/.test(value)) {
                              updateCurrentLog('reps', value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || parseInt(value) === 0) {
                              updateCurrentLog('reps', '0');
                            }
                          }}
                          className="h-20 text-3xl text-center font-bold bg-white/5 border-white/20 rounded-2xl pr-10 transition-all focus:shadow-glow-primary"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => incrementValue('reps')}
                            className="tap-target flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all hover:shadow-glow-primary"
                          >
                            <ChevronUp className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => decrementValue('reps')}
                            className="tap-target flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all hover:shadow-glow-primary"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="sets" className="text-lg font-bold text-muted-foreground">
                        Sets
                      </Label>
                      <div className="relative">
                        <Input
                          id="sets"
                          type="text"
                          inputMode="numeric"
                          value={totalSets}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d+$/.test(value)) {
                              const num = value === '' ? 1 : parseInt(value);
                              if (num >= 1 && num <= 10) {
                                updateSetsCount(num);
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || parseInt(value) === 0) {
                              updateSetsCount(1);
                            }
                          }}
                          className="h-20 text-3xl text-center font-bold bg-white/5 border-white/20 rounded-2xl pr-10 transition-all focus:shadow-glow-primary"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => incrementValue('sets')}
                            className="tap-target flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all hover:shadow-glow-primary"
                          >
                            <ChevronUp className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => decrementValue('sets')}
                            className="tap-target flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all hover:shadow-glow-primary"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleLogSet}
                    size="lg"
                    disabled={saveSetConfig.isPending || updateSuggestedWeight.isPending}
                    className="w-full h-20 text-2xl font-bold bg-primary hover:bg-primary/90 active:scale-95 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
                  >
                    {(saveSetConfig.isPending || updateSuggestedWeight.isPending) ? (
                      <Loader2 className="mr-3 h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-3 h-8 w-8" />
                        Log Set
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-6 mt-8">
                <div className="flex items-center justify-center gap-3">
                  <Badge variant="default" className="text-base px-4 py-2 bg-primary/20 text-primary border-primary/30 rounded-xl">
                    {getMuscleGroupForTransition(currentExercise)}
                  </Badge>
                  <Badge variant="outline" className="text-base px-4 py-2 bg-white/5 border-white/20 rounded-xl">
                    {currentExercise.exercise.equipmentType}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleChangeClick}
                    className="hover:bg-white/10 active:scale-90 rounded-xl tap-target transition-all hover:shadow-glow-primary"
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Change
                  </Button>
                </div>

                <div className="flex justify-center">
                  <a
                    href={currentExercise.exercise.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:text-primary/80 transition-all text-base font-semibold active:scale-95 tap-target hover:shadow-glow-primary"
                  >
                    <ExternalLink className="h-5 w-5" />
                    <span>View Demo</span>
                  </a>
                </div>
              </div>

              {!isLastSet && currentLog?.completed && (
                <div className="mt-8">
                  <Button
                    onClick={handleNextExercise}
                    variant="outline"
                    size="lg"
                    className="w-full h-16 text-lg font-bold bg-white/5 border-white/20 hover:bg-white/10 active:scale-95 rounded-2xl tap-target transition-all hover:shadow-glow-primary"
                  >
                    <SkipForward className="mr-2 h-6 w-6" />
                    Next Exercise
                  </Button>
                </div>
              )}

              {allSetsCompleted && (
                <Card className="border-2 border-primary/30 bg-primary/5 mt-8 rounded-2xl shadow-glow-primary">
                  <CardContent className="py-10 text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-glow-primary">
                        <Check className="h-10 w-10 text-primary-foreground" />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">Workout Complete!</p>
                      <p className="text-lg text-muted-foreground mt-2">
                        Great job! Tap "Done" to save your workout.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      <ExerciseChangeModal
        open={changeModalOpen}
        onOpenChange={setChangeModalOpen}
        currentExercise={currentExercise.exercise}
        onExerciseSelected={handleExerciseSelected}
      />
    </div>
  );
}
