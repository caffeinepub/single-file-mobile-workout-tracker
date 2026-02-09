import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { UserProfile, WeightUnit, Gender, TrainingFrequency, WorkoutWithNote as BackendWorkoutWithNote } from '../backend';
import type { Exercise, WorkoutExercise, Workout, RecoveryState, SetConfiguration, MuscleGroupVolume, MuscleRecovery, LegSubgroupRecovery } from '../types';
import { toast } from 'sonner';

const DEFAULT_PROFILE: UserProfile = {
  gender: 'male' as Gender,
  bodyweight: 70,
  weightUnit: 'kg' as WeightUnit,
  trainingFrequency: 'fourDays' as TrainingFrequency,
  darkMode: true,
  restTime: BigInt(90),
  muscleGroupRestInterval: BigInt(5),
};

/**
 * Log with timestamp for debugging
 */
function logWithTimestamp(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Queries] ${message}`, ...args);
}

// Helper function to extract error message from backend errors
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error) {
      return String(error.message);
    }
    // Handle backend Result error types
    if ('__kind__' in error && error.__kind__ === 'err') {
      const err = (error as any).err;
      if (err && typeof err === 'object' && '__kind__' in err) {
        const errorType = err.__kind__;
        const errorValue = err[errorType];
        return errorValue || `Error: ${errorType}`;
      }
    }
  }
  return 'An unknown error occurred';
}

// Helper function to check if error is an authorization error
function isAuthError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes('unauthorized') || message.includes('permission');
}

// Helper function to check if error is a delegation expiry error
function isDelegationExpiryError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes('delegation') && message.includes('expir') ||
    message.includes('invalid delegation') ||
    message.includes('delegation has expired') ||
    message.includes('specified sender delegation has expired') ||
    message.includes('400') && message.includes('delegation')
  );
}

// Helper function to check if error is a validation error
function isValidationError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes('invalid') || message.includes('must be');
}

// Helper function to check if error is an optimization/generation error
function isOptimizationError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes('optimization') || 
         message.includes('not enough') || 
         message.includes('duplicate') ||
         message.includes('failed validation') ||
         message.includes('recovery') ||
         message.includes('rest');
}

// Helper function to validate workout data
function validateWorkout(backendWorkout: BackendWorkoutWithNote): boolean {
  // Check if workout exists
  if (!backendWorkout) {
    logWithTimestamp('Workout validation failed: workout is null or undefined');
    return false;
  }

  // Check if exercises array exists and is not empty
  if (!backendWorkout.exercises || !Array.isArray(backendWorkout.exercises) || backendWorkout.exercises.length === 0) {
    logWithTimestamp('Workout validation failed: exercises array is empty or invalid');
    return false;
  }

  // Check for duplicate exercises
  const exerciseNames = new Set<string>();
  for (const we of backendWorkout.exercises) {
    if (!we.exercise || !we.exercise.name) {
      logWithTimestamp('Workout validation failed: exercise has no name');
      return false;
    }
    if (exerciseNames.has(we.exercise.name)) {
      logWithTimestamp(`Workout validation failed: duplicate exercise found: ${we.exercise.name}`);
      return false;
    }
    exerciseNames.add(we.exercise.name);
  }

  // Validate each exercise
  for (const we of backendWorkout.exercises) {
    // Check exercise structure
    if (!we.exercise) {
      logWithTimestamp('Workout validation failed: exercise is missing');
      return false;
    }

    // Check required exercise fields
    if (!we.exercise.name || typeof we.exercise.name !== 'string') {
      logWithTimestamp('Workout validation failed: exercise name is invalid');
      return false;
    }
    if (!we.exercise.primaryMuscleGroup || typeof we.exercise.primaryMuscleGroup !== 'string') {
      logWithTimestamp('Workout validation failed: primaryMuscleGroup is invalid');
      return false;
    }
    if (!we.exercise.equipmentType || typeof we.exercise.equipmentType !== 'string') {
      logWithTimestamp('Workout validation failed: equipmentType is invalid');
      return false;
    }
    if (!we.exercise.demoUrl || typeof we.exercise.demoUrl !== 'string') {
      logWithTimestamp('Workout validation failed: demoUrl is invalid');
      return false;
    }

    // Check sets and reps
    if (typeof we.sets !== 'bigint' || we.sets <= 0n) {
      logWithTimestamp(`Workout validation failed: invalid sets for ${we.exercise.name}`);
      return false;
    }
    if (typeof we.reps !== 'bigint' || we.reps <= 0n) {
      logWithTimestamp(`Workout validation failed: invalid reps for ${we.exercise.name}`);
      return false;
    }

    // Check suggested weight (can be 0 for bodyweight exercises)
    if (typeof we.suggestedWeight !== 'number' || we.suggestedWeight < 0) {
      logWithTimestamp(`Workout validation failed: invalid suggestedWeight for ${we.exercise.name}`);
      return false;
    }

    // Check setData array
    if (!Array.isArray(we.setData)) {
      logWithTimestamp(`Workout validation failed: setData is not an array for ${we.exercise.name}`);
      return false;
    }
  }

  logWithTimestamp('Workout validation passed');
  return true;
}

// Helper function to convert backend WorkoutWithNote to frontend Workout
function convertBackendWorkoutWithNote(backendWorkout: BackendWorkoutWithNote): Workout & { note?: string } {
  return {
    exercises: backendWorkout.exercises.map(we => ({
      exercise: {
        name: we.exercise.name,
        primaryMuscleGroup: we.exercise.primaryMuscleGroup,
        equipmentType: we.exercise.equipmentType,
        demoUrl: we.exercise.demoUrl,
        recoveryTime: Number(we.exercise.recoveryTime),
      },
      sets: Number(we.sets),
      reps: Number(we.reps),
      suggestedWeight: we.suggestedWeight,
      setData: we.setData.map(sd => ({
        weight: sd.weight,
        reps: Number(sd.reps),
      })),
    })),
    timestamp: backendWorkout.timestamp,
    totalVolume: backendWorkout.totalVolume,
    note: backendWorkout.note || undefined,
  };
}

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('Fetching user profile');
      
      try {
        const result = await actor.getCallerUserProfile();
        
        // Handle Result type from backend
        if (result.__kind__ === 'ok') {
          const profile = result.ok;
          
          if (profile === null) {
            logWithTimestamp('No profile found, creating default');
            try {
              const saveResult = await actor.saveCallerUserProfile(DEFAULT_PROFILE);
              if (saveResult.__kind__ === 'ok') {
                queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
                return DEFAULT_PROFILE;
              }
            } catch (createError) {
              logWithTimestamp('Failed to create default profile:', createError);
              return DEFAULT_PROFILE;
            }
          }
          
          logWithTimestamp('Profile loaded successfully');
          return profile;
        } else {
          const errorMsg = extractErrorMessage(result.err);
          logWithTimestamp('Failed to fetch profile:', errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error) {
        logWithTimestamp('Failed to fetch profile:', error);
        if (isAuthError(error)) {
          toast.error('Authentication required. Please log in again.');
        } else if (isDelegationExpiryError(error)) {
          toast.error('Session expired. Please log in again.');
        }
        try {
          const saveResult = await actor.saveCallerUserProfile(DEFAULT_PROFILE);
          if (saveResult.__kind__ === 'ok') {
            return DEFAULT_PROFILE;
          }
        } catch (createError) {
          logWithTimestamp('Failed to create default profile:', createError);
        }
        return DEFAULT_PROFILE;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 30000,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && !actorFetching && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      
      const result = await actor.saveCallerUserProfile(profile);
      
      if (result.__kind__ === 'ok') {
        return result.ok;
      } else {
        const errorMsg = extractErrorMessage(result.err);
        throw new Error(errorMsg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      toast.success('Profile saved successfully');
    },
    onError: (error) => {
      logWithTimestamp('Profile save error:', error);
      const message = extractErrorMessage(error);
      if (isValidationError(error)) {
        toast.error(`Validation error: ${message}`);
      } else if (isAuthError(error)) {
        toast.error('Authentication required. Please log in again.');
      } else if (isDelegationExpiryError(error)) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to save profile');
      }
    },
  });
}

export function useUpdateProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bodyweight, 
      weightUnit, 
      muscleGroupRestInterval 
    }: { 
      bodyweight?: number; 
      weightUnit?: WeightUnit;
      muscleGroupRestInterval?: number;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      const profileResult = await actor.getCallerUserProfile();
      
      if (profileResult.__kind__ === 'err') {
        throw new Error(extractErrorMessage(profileResult.err));
      }
      
      const currentProfile = profileResult.ok;
      
      if (currentProfile === null) {
        throw new Error('Profile not found');
      }
      
      const updatedProfile: UserProfile = {
        gender: currentProfile.gender,
        bodyweight: bodyweight !== undefined ? bodyweight : currentProfile.bodyweight,
        weightUnit: weightUnit !== undefined ? weightUnit : currentProfile.weightUnit,
        trainingFrequency: currentProfile.trainingFrequency,
        darkMode: currentProfile.darkMode,
        restTime: currentProfile.restTime,
        muscleGroupRestInterval: muscleGroupRestInterval !== undefined ? BigInt(muscleGroupRestInterval) : currentProfile.muscleGroupRestInterval,
      };
      
      const saveResult = await actor.saveCallerUserProfile(updatedProfile);
      
      if (saveResult.__kind__ === 'ok') {
        return true;
      } else {
        throw new Error(extractErrorMessage(saveResult.err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      logWithTimestamp('Profile update error:', error);
      const message = extractErrorMessage(error);
      if (isValidationError(error)) {
        toast.error(`Validation error: ${message}`);
      } else if (isAuthError(error)) {
        toast.error('Authentication required. Please log in again.');
      } else if (isDelegationExpiryError(error)) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to update profile');
      }
    },
  });
}

export function useIsTestRecoveryModeEnabled() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<boolean>({
    queryKey: ['testRecoveryMode'],
    queryFn: async (): Promise<boolean> => {
      if (!actor) return false;
      
      logWithTimestamp('Checking test recovery mode status');
      
      try {
        const result = await actor.isTestRecoveryModeEnabled();
        logWithTimestamp('Test recovery mode status:', result);
        return result;
      } catch (error) {
        logWithTimestamp('Error checking test recovery mode:', error);
        return false;
      }
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 60000,
    retry: 1,
  });
}

export function useGetAlternativeExercises(muscleGroup: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Exercise[]>({
    queryKey: ['alternativeExercises', muscleGroup],
    queryFn: async (): Promise<Exercise[]> => {
      if (!actor) return [];
      
      logWithTimestamp(`Alternative exercises not implemented in backend for ${muscleGroup}`);
      // Backend method not implemented yet
      return [];
    },
    enabled: !!actor && !isFetching && !!muscleGroup,
    staleTime: 300000,
    retry: 1,
  });
}

export function useRecordExerciseChange() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ originalExercise, alternativeExercise }: { originalExercise: string; alternativeExercise: string }) => {
      if (!actor) throw new Error('Actor not available');
      logWithTimestamp('recordExerciseChange not implemented in backend');
      return;
    },
    onError: (error) => {
      logWithTimestamp('Failed to record exercise change:', error);
    },
  });
}

export type WorkoutType = 'fullBody' | 'upperBody' | 'lowerBody' | 'lowerBodyWithCore';

export function useGenerateWorkout() {
  const generateFullBody = useGenerateFullBodyWorkout();
  const generateUpperBody = useGenerateUpperBodyWorkout();
  const generateLowerBody = useGenerateLowerBodyWorkout();

  return useMutation({
    mutationFn: async (workoutType: WorkoutType) => {
      if (workoutType === 'fullBody') {
        return await generateFullBody.mutateAsync();
      } else if (workoutType === 'upperBody') {
        return await generateUpperBody.mutateAsync();
      } else {
        // Both lowerBody and lowerBodyWithCore use the same unified generator
        return await generateLowerBody.mutateAsync();
      }
    },
  });
}

export function useGenerateFullBodyWorkout() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('Generating full body workout');
      
      const result = await actor.generateLowerBodyWorkout();
      
      if (result.__kind__ === 'ok') {
        const backendWorkout = result.ok;
        
        if (!validateWorkout(backendWorkout)) {
          throw new Error('Generated workout failed validation');
        }
        
        const workout = convertBackendWorkoutWithNote(backendWorkout);
        logWithTimestamp('Full body workout generated successfully');
        return workout;
      } else {
        const errorMsg = extractErrorMessage(result.err);
        logWithTimestamp('Full body workout generation failed:', errorMsg);
        throw new Error(errorMsg);
      }
    },
    onSuccess: (workout) => {
      queryClient.setQueryData(['currentWorkout'], workout);
      queryClient.invalidateQueries({ queryKey: ['recoveryState'] });
      logWithTimestamp('Full body workout generated successfully');
    },
    onError: (error) => {
      logWithTimestamp('Full body workout generation error:', error);
      const message = extractErrorMessage(error);
      if (isOptimizationError(error)) {
        toast.error(message, { duration: 5000 });
      } else if (isAuthError(error)) {
        toast.error('Authentication required. Please log in again.');
      } else if (isDelegationExpiryError(error)) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to generate workout');
      }
    },
  });
}

export function useGenerateUpperBodyWorkout() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('Generating upper body workout');
      
      const result = await actor.generateLowerBodyWorkout();
      
      if (result.__kind__ === 'ok') {
        const backendWorkout = result.ok;
        
        if (!validateWorkout(backendWorkout)) {
          throw new Error('Generated workout failed validation');
        }
        
        const workout = convertBackendWorkoutWithNote(backendWorkout);
        logWithTimestamp('Upper body workout generated successfully');
        return workout;
      } else {
        const errorMsg = extractErrorMessage(result.err);
        logWithTimestamp('Upper body workout generation failed:', errorMsg);
        throw new Error(errorMsg);
      }
    },
    onSuccess: (workout) => {
      queryClient.setQueryData(['currentWorkout'], workout);
      queryClient.invalidateQueries({ queryKey: ['recoveryState'] });
      logWithTimestamp('Upper body workout generated successfully');
    },
    onError: (error) => {
      logWithTimestamp('Upper body workout generation error:', error);
      const message = extractErrorMessage(error);
      if (isOptimizationError(error)) {
        toast.error(message, { duration: 5000 });
      } else if (isAuthError(error)) {
        toast.error('Authentication required. Please log in again.');
      } else if (isDelegationExpiryError(error)) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to generate workout');
      }
    },
  });
}

export function useGenerateLowerBodyWorkout() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('Generating lower body workout');
      
      const result = await actor.generateLowerBodyWorkout();
      
      if (result.__kind__ === 'ok') {
        const backendWorkout = result.ok;
        
        if (!validateWorkout(backendWorkout)) {
          throw new Error('Generated workout failed validation');
        }
        
        const workout = convertBackendWorkoutWithNote(backendWorkout);
        logWithTimestamp('Lower body workout generated successfully');
        return workout;
      } else {
        const errorMsg = extractErrorMessage(result.err);
        logWithTimestamp('Lower body workout generation failed:', errorMsg);
        throw new Error(errorMsg);
      }
    },
    onSuccess: (workout) => {
      queryClient.setQueryData(['currentWorkout'], workout);
      queryClient.invalidateQueries({ queryKey: ['recoveryState'] });
      logWithTimestamp('Lower body workout generated successfully');
    },
    onError: (error) => {
      logWithTimestamp('Lower body workout generation error:', error);
      const message = extractErrorMessage(error);
      if (isOptimizationError(error)) {
        toast.error(message, { duration: 5000 });
      } else if (isAuthError(error)) {
        toast.error('Authentication required. Please log in again.');
      } else if (isDelegationExpiryError(error)) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to generate workout');
      }
    },
  });
}

export function useGetRecoveryState() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<RecoveryState>({
    queryKey: ['recoveryState'],
    queryFn: async (): Promise<RecoveryState> => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('Fetching recovery state');
      
      try {
        const result = await actor.getRecoveryState();
        
        if (result.__kind__ === 'ok') {
          const state = result.ok;
          
          const recoveryState: RecoveryState = {
            chest: {
              lastTrained: Number(state.chest.lastTrained),
              recoveryPercentage: state.chest.recoveryPercentage,
            },
            back: {
              lastTrained: Number(state.back.lastTrained),
              recoveryPercentage: state.back.recoveryPercentage,
            },
            legs: {
              lastTrained: Number(state.legs.lastTrained),
              recoveryPercentage: state.legs.recoveryPercentage,
            },
            shoulders: {
              lastTrained: Number(state.shoulders.lastTrained),
              recoveryPercentage: state.shoulders.recoveryPercentage,
            },
            arms: {
              lastTrained: Number(state.arms.lastTrained),
              recoveryPercentage: state.arms.recoveryPercentage,
            },
            core: {
              lastTrained: Number(state.core.lastTrained),
              recoveryPercentage: state.core.recoveryPercentage,
            },
            quadsRecovery: {
              lastTrained: Number(state.quadsRecovery.lastTrained),
              recoveryPercentage: state.quadsRecovery.recoveryPercentage,
            },
            hamstringsRecovery: {
              lastTrained: Number(state.hamstringsRecovery.lastTrained),
              recoveryPercentage: state.hamstringsRecovery.recoveryPercentage,
            },
            glutesRecovery: {
              lastTrained: Number(state.glutesRecovery.lastTrained),
              recoveryPercentage: state.glutesRecovery.recoveryPercentage,
            },
            calvesRecovery: {
              lastTrained: Number(state.calvesRecovery.lastTrained),
              recoveryPercentage: state.calvesRecovery.recoveryPercentage,
            },
          };
          
          logWithTimestamp('Recovery state loaded successfully');
          return recoveryState;
        } else {
          const errorMsg = extractErrorMessage(result.err);
          logWithTimestamp('Failed to fetch recovery state:', errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error) {
        logWithTimestamp('Failed to fetch recovery state:', error);
        if (isAuthError(error)) {
          toast.error('Authentication required. Please log in again.');
        } else if (isDelegationExpiryError(error)) {
          toast.error('Session expired. Please log in again.');
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 30000,
    retry: 2,
  });
}

export function useGetLegSubgroupRecovery() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<LegSubgroupRecovery>({
    queryKey: ['legSubgroupRecovery'],
    queryFn: async (): Promise<LegSubgroupRecovery> => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('Fetching leg subgroup recovery');
      
      try {
        const result = await actor.getLegSubgroupRecovery();
        
        if (result.__kind__ === 'ok') {
          const state = result.ok;
          
          const legSubgroupRecovery: LegSubgroupRecovery = {
            quads: {
              lastTrained: Number(state.quads.lastTrained),
              recoveryPercentage: state.quads.recoveryPercentage,
            },
            hamstrings: {
              lastTrained: Number(state.hamstrings.lastTrained),
              recoveryPercentage: state.hamstrings.recoveryPercentage,
            },
            glutes: {
              lastTrained: Number(state.glutes.lastTrained),
              recoveryPercentage: state.glutes.recoveryPercentage,
            },
            calves: {
              lastTrained: Number(state.calves.lastTrained),
              recoveryPercentage: state.calves.recoveryPercentage,
            },
            legs: {
              lastTrained: Number(state.legs.lastTrained),
              recoveryPercentage: state.legs.recoveryPercentage,
            },
          };
          
          logWithTimestamp('Leg subgroup recovery loaded successfully');
          return legSubgroupRecovery;
        } else {
          const errorMsg = extractErrorMessage(result.err);
          logWithTimestamp('Failed to fetch leg subgroup recovery:', errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error) {
        logWithTimestamp('Failed to fetch leg subgroup recovery:', error);
        if (isAuthError(error)) {
          toast.error('Authentication required. Please log in again.');
        } else if (isDelegationExpiryError(error)) {
          toast.error('Session expired. Please log in again.');
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 30000,
    retry: 2,
  });
}

export function useGetWorkoutHistory() {
  const { actor, isFetching } = useActor();

  return useQuery<Workout[]>({
    queryKey: ['workoutHistory'],
    queryFn: async (): Promise<Workout[]> => {
      if (!actor) return [];
      
      logWithTimestamp('Workout history not implemented in backend');
      // Backend method not implemented yet
      return [];
    },
    enabled: !!actor && !isFetching,
    staleTime: 60000,
    retry: 1,
  });
}

export function useGetWeeklyMuscleGroupVolume() {
  const { actor, isFetching } = useActor();

  return useQuery<MuscleGroupVolume[]>({
    queryKey: ['weeklyMuscleGroupVolume'],
    queryFn: async (): Promise<MuscleGroupVolume[]> => {
      if (!actor) return [];
      
      logWithTimestamp('Weekly muscle group volume not implemented in backend');
      // Backend method not implemented yet
      return [];
    },
    enabled: !!actor && !isFetching,
    staleTime: 60000,
    retry: 1,
  });
}

export function useSaveWorkout() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workout: Workout) => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('saveWorkout not implemented in backend');
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
      queryClient.invalidateQueries({ queryKey: ['recoveryState'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyMuscleGroupVolume'] });
      toast.success('Workout saved successfully');
    },
    onError: (error) => {
      logWithTimestamp('Failed to save workout:', error);
      const message = extractErrorMessage(error);
      if (isAuthError(error)) {
        toast.error('Authentication required. Please log in again.');
      } else if (isDelegationExpiryError(error)) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to save workout');
      }
    },
  });
}

export function useSaveSetConfiguration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ exerciseName, config }: { exerciseName: string; config: SetConfiguration }) => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('saveSetConfiguration not implemented in backend');
      return;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['setConfiguration', variables.exerciseName] });
      logWithTimestamp('Set configuration saved');
    },
    onError: (error) => {
      logWithTimestamp('Failed to save set configuration:', error);
    },
  });
}

export function useGetSetConfiguration(exerciseName?: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Record<string, SetConfiguration>>({
    queryKey: ['setConfiguration', exerciseName || 'all'],
    queryFn: async (): Promise<Record<string, SetConfiguration>> => {
      if (!actor) return {};
      
      logWithTimestamp('getSetConfiguration not implemented in backend');
      // Backend method not implemented yet
      return {};
    },
    enabled: !!actor && !isFetching,
    staleTime: 300000,
    retry: 1,
  });
}

export function useClearSetConfigurations() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      logWithTimestamp('clearSetConfigurations not implemented in backend');
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setConfiguration'] });
      logWithTimestamp('Set configurations cleared');
    },
    onError: (error) => {
      logWithTimestamp('Failed to clear set configurations:', error);
    },
  });
}

export function useUpdateSuggestedWeightDuringSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ exerciseName, newWeight }: { exerciseName: string; newWeight: number }) => {
      logWithTimestamp('updateSuggestedWeightDuringSession - client-side only');
      return newWeight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentWorkout'] });
    },
  });
}
