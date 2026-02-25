import { useState, useEffect, Suspense, lazy } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useQueries';
import { UserProfile } from './backend';
import { WorkoutExercise, Exercise } from './types';
import { WorkoutType } from './hooks/useQueries';
import { Toaster } from '@/components/ui/sonner';
import SplashScreen from './components/SplashScreen';
import BottomNav from './components/BottomNav';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NewWorkoutPage = lazy(() => import('./pages/NewWorkoutPage'));
const WorkoutPreviewPage = lazy(() => import('./pages/WorkoutPreviewPage'));
const WorkoutSessionPage = lazy(() => import('./pages/WorkoutSessionPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));

type AppPage = 'login' | 'onboarding' | 'dashboard' | 'newWorkout' | 'workoutPreview' | 'workoutSession' | 'history' | 'progress';
type NavPage = 'dashboard' | 'newWorkout' | 'history' | 'progress' | 'settings';

function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
  const [currentPage, setCurrentPage] = useState<AppPage>('login');
  const [generatedWorkout, setGeneratedWorkout] = useState<WorkoutExercise[]>([]);
  const [workoutType, setWorkoutType] = useState<WorkoutType>('fullBody');
  const [showSplash, setShowSplash] = useState(true);

  const isAuthenticated = !!identity;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentPage('login');
    } else if (isAuthenticated && !profileLoading && isFetched && userProfile === null) {
      setCurrentPage('onboarding');
    } else if (isAuthenticated && userProfile && currentPage === 'login') {
      setCurrentPage('dashboard');
    }
  }, [isAuthenticated, userProfile, profileLoading, isFetched, currentPage]);

  const handleWorkoutGenerated = (workout: WorkoutExercise[], type: WorkoutType) => {
    // Validate workout before setting
    if (!workout || workout.length === 0) {
      toast.error('Generated workout is empty. Please try again.');
      return;
    }

    // Check for duplicates
    const exerciseNames = new Set<string>();
    for (const ex of workout) {
      if (!ex.exercise || !ex.exercise.name) {
        toast.error('Invalid exercise data. Please regenerate workout.');
        return;
      }
      if (exerciseNames.has(ex.exercise.name)) {
        toast.error(`Duplicate exercise detected: ${ex.exercise.name}. Please regenerate.`);
        return;
      }
      exerciseNames.add(ex.exercise.name);
    }

    // Validate exercise data
    for (const ex of workout) {
      if (!ex.exercise.primaryMuscleGroup || !ex.exercise.equipmentType || !ex.exercise.demoUrl) {
        toast.error('Incomplete exercise data. Please regenerate workout.');
        return;
      }
      if (ex.sets <= 0 || ex.reps <= 0) {
        toast.error(`Invalid sets/reps for ${ex.exercise.name}. Please regenerate.`);
        return;
      }
      if (ex.suggestedWeight < 0) {
        toast.error(`Invalid weight for ${ex.exercise.name}. Please regenerate.`);
        return;
      }
    }

    setGeneratedWorkout(workout);
    setWorkoutType(type);
    setCurrentPage('workoutPreview');
  };

  const handleExerciseChange = (index: number, newExercise: Exercise) => {
    // Validate new exercise
    if (!newExercise || !newExercise.name || !newExercise.primaryMuscleGroup) {
      toast.error('Invalid exercise selected');
      return;
    }

    // Check if exercise already exists in workout
    const isDuplicate = generatedWorkout.some((ex, idx) => 
      idx !== index && ex.exercise.name === newExercise.name
    );

    if (isDuplicate) {
      toast.error(`${newExercise.name} is already in this workout`);
      return;
    }

    const updatedWorkout = [...generatedWorkout];
    updatedWorkout[index] = {
      ...updatedWorkout[index],
      exercise: newExercise,
    };
    setGeneratedWorkout(updatedWorkout);
  };

  const handleNavigate = (page: NavPage) => {
    // Map NavPage to AppPage (settings is handled by modal, not a page)
    if (page !== 'settings') {
      setCurrentPage(page as AppPage);
    }
  };

  if (showSplash) {
    return <SplashScreen />;
  }

  if (isInitializing) {
    return <LoadingScreen message="Initializing secure connection..." />;
  }

  if (isAuthenticated && profileLoading) {
    return <LoadingScreen message="Loading your profile..." />;
  }

  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

  if (showProfileSetup) {
    return (
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        <OnboardingPage />
        <Toaster position="top-center" />
      </Suspense>
    );
  }

  const showBottomNav = isAuthenticated && userProfile && !['login', 'onboarding', 'workoutPreview', 'workoutSession'].includes(currentPage);

  // Map currentPage to NavPage for BottomNav
  const getNavPage = (): NavPage => {
    if (currentPage === 'dashboard' || currentPage === 'newWorkout' || currentPage === 'history' || currentPage === 'progress') {
      return currentPage;
    }
    return 'dashboard'; // Default fallback
  };

  return (
    <>
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        {currentPage === 'login' && <LoginPage />}
        {currentPage === 'dashboard' && userProfile && (
          <DashboardPage
            userProfile={userProfile}
            onNavigateToNewWorkout={() => setCurrentPage('newWorkout')}
            onNavigateToHistory={() => setCurrentPage('history')}
            onNavigateToProgress={() => setCurrentPage('progress')}
          />
        )}
        {currentPage === 'newWorkout' && userProfile && (
          <NewWorkoutPage
            userProfile={userProfile}
            onBack={() => setCurrentPage('dashboard')}
            onWorkoutGenerated={handleWorkoutGenerated}
          />
        )}
        {currentPage === 'workoutPreview' && userProfile && generatedWorkout.length > 0 && (
          <WorkoutPreviewPage
            userProfile={userProfile}
            workout={generatedWorkout}
            workoutType={workoutType}
            onBack={() => setCurrentPage('newWorkout')}
            onStartWorkout={() => setCurrentPage('workoutSession')}
            onExerciseChange={handleExerciseChange}
          />
        )}
        {currentPage === 'workoutSession' && userProfile && generatedWorkout.length > 0 && (
          <WorkoutSessionPage
            userProfile={userProfile}
            workout={generatedWorkout}
            onBack={() => setCurrentPage('dashboard')}
            onExerciseChange={handleExerciseChange}
          />
        )}
        {currentPage === 'history' && userProfile && (
          <HistoryPage userProfile={userProfile} onBack={() => setCurrentPage('dashboard')} />
        )}
        {currentPage === 'progress' && userProfile && (
          <ProgressPage userProfile={userProfile} onBack={() => setCurrentPage('dashboard')} />
        )}
      </Suspense>
      
      {showBottomNav && userProfile && (
        <BottomNav
          currentPage={getNavPage()}
          onNavigate={handleNavigate}
          userProfile={userProfile}
        />
      )}
      
      <Toaster position="top-center" />
    </>
  );
}

export default App;
