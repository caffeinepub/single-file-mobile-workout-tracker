// Frontend-only types that extend or complement the backend interface
// These types are used by the frontend but not exported from the backend

export interface Exercise {
  name: string;
  primaryMuscleGroup: string;
  equipmentType: string;
  demoUrl: string;
  recoveryTime: number;
}

export interface SetData {
  weight: number;
  reps: number;
}

export interface WorkoutExercise {
  exercise: Exercise;
  sets: number;
  reps: number;
  suggestedWeight: number;
  setData: SetData[];
}

export interface Workout {
  exercises: WorkoutExercise[];
  timestamp: bigint;
  totalVolume: number;
}

export interface MuscleRecovery {
  lastTrained: number;
  recoveryPercentage: number;
}

export interface RecoveryState {
  chest: MuscleRecovery;
  back: MuscleRecovery;
  legs: MuscleRecovery;
  shoulders: MuscleRecovery;
  arms: MuscleRecovery;
  core: MuscleRecovery;
  quadsRecovery: MuscleRecovery;
  hamstringsRecovery: MuscleRecovery;
  glutesRecovery: MuscleRecovery;
  calvesRecovery: MuscleRecovery;
}

export interface LegSubgroupRecovery {
  quads: MuscleRecovery;
  hamstrings: MuscleRecovery;
  glutes: MuscleRecovery;
  calves: MuscleRecovery;
  legs: MuscleRecovery;
}

export interface WorkoutSummary {
  date: bigint;
  exercises: string[];
}

export interface ExerciseChange {
  originalExercise: string;
  alternativeExercise: string;
  timestamp: bigint;
}

export interface MuscleGroupVolume {
  muscleGroup: string;
  weeklyVolume: number;
  intensity: number;
}

export interface DailyWorkoutIntensity {
  date: bigint;
  totalVolume: number;
  intensity: number;
}

export interface LastTrainedDate {
  muscleGroup: string;
  lastTrained: bigint;
}

export interface SetConfiguration {
  weight: number;
  reps: bigint;
  sets: bigint;
}
