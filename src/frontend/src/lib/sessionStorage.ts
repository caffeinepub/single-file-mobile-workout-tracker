/**
 * Session storage utilities for persisting active workout sessions
 * Ensures workout progress is not lost on browser reload or temporary disconnections
 */

const SESSION_STORAGE_KEY = 'active-workout-session';

export interface WorkoutSessionState {
  workout: any[];
  workoutType: string;
  currentExerciseIdx: number;
  currentSetIdx: number;
  exerciseLogs: Record<number, any[]>;
  customSetsCount: Record<number, number>;
  timestamp: number;
}

/**
 * Save the current workout session to sessionStorage
 */
export function saveWorkoutSession(state: WorkoutSessionState): void {
  try {
    const serialized = JSON.stringify(state);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    console.log('[SessionStorage] Workout session saved');
  } catch (error) {
    console.error('[SessionStorage] Failed to save workout session:', error);
  }
}

/**
 * Load the workout session from sessionStorage
 */
export function loadWorkoutSession(): WorkoutSessionState | null {
  try {
    const serialized = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!serialized) {
      return null;
    }
    
    const state = JSON.parse(serialized) as WorkoutSessionState;
    
    // Check if session is not too old (max 24 hours)
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (now - state.timestamp > maxAge) {
      console.log('[SessionStorage] Workout session expired, clearing');
      clearWorkoutSession();
      return null;
    }
    
    console.log('[SessionStorage] Workout session loaded');
    return state;
  } catch (error) {
    console.error('[SessionStorage] Failed to load workout session:', error);
    return null;
  }
}

/**
 * Clear the workout session from sessionStorage
 */
export function clearWorkoutSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    console.log('[SessionStorage] Workout session cleared');
  } catch (error) {
    console.error('[SessionStorage] Failed to clear workout session:', error);
  }
}

/**
 * Check if there's an active workout session
 */
export function hasActiveWorkoutSession(): boolean {
  return sessionStorage.getItem(SESSION_STORAGE_KEY) !== null;
}
