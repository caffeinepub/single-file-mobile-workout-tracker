import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Exercise {
    primaryMuscleGroup: string;
    recoveryTime: bigint;
    name: string;
    equipmentType: string;
    demoUrl: string;
}
export interface WorkoutWithNote {
    totalVolume: number;
    note: string;
    exercises: Array<WorkoutExercise>;
    timestamp: bigint;
}
export type Result_2 = {
    __kind__: "ok";
    ok: Array<Workout>;
} | {
    __kind__: "err";
    err: AppError;
};
export type Result_6 = {
    __kind__: "ok";
    ok: Array<Exercise>;
} | {
    __kind__: "err";
    err: AppError;
};
export interface SetData {
    weight: number;
    reps: bigint;
}
export type AppError = {
    __kind__: "userNotFound";
    userNotFound: string;
} | {
    __kind__: "userProfileNotFound";
    userProfileNotFound: string;
} | {
    __kind__: "adminOnly";
    adminOnly: string;
} | {
    __kind__: "internalError";
    internalError: string;
} | {
    __kind__: "badArguments";
    badArguments: string;
} | {
    __kind__: "optimizationFailed";
    optimizationFailed: string;
} | {
    __kind__: "unauthorized";
    unauthorized: string;
};
export interface MuscleRecovery {
    lastTrained: bigint;
    recoveryPercentage: number;
}
export type Result_5 = {
    __kind__: "ok";
    ok: {
        legs: MuscleRecovery;
        quads: MuscleRecovery;
        hamstrings: MuscleRecovery;
        glutes: MuscleRecovery;
        calves: MuscleRecovery;
    };
} | {
    __kind__: "err";
    err: AppError;
};
export type Result_1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: AppError;
};
export type Result_4 = {
    __kind__: "ok";
    ok: {
        calvesRecovery: MuscleRecovery;
        quadsRecovery: MuscleRecovery;
        hamstringsRecovery: MuscleRecovery;
        shoulders: MuscleRecovery;
        arms: MuscleRecovery;
        back: MuscleRecovery;
        core: MuscleRecovery;
        chest: MuscleRecovery;
        legs: MuscleRecovery;
        glutesRecovery: MuscleRecovery;
    };
} | {
    __kind__: "err";
    err: AppError;
};
export type Result = {
    __kind__: "ok";
    ok: number;
} | {
    __kind__: "err";
    err: AppError;
};
export type Result_3 = {
    __kind__: "ok";
    ok: UserProfile | null;
} | {
    __kind__: "err";
    err: AppError;
};
export type Result_7 = {
    __kind__: "ok";
    ok: WorkoutWithNote;
} | {
    __kind__: "err";
    err: AppError;
};
export interface Workout {
    totalVolume: number;
    exercises: Array<WorkoutExercise>;
    timestamp: bigint;
}
export interface WorkoutExercise {
    setData: Array<SetData>;
    suggestedWeight: number;
    reps: bigint;
    sets: bigint;
    exercise: Exercise;
}
export interface UserProfile {
    bodyweight: number;
    muscleGroupRestInterval: bigint;
    trainingFrequency: TrainingFrequency;
    weightUnit: WeightUnit;
    darkMode: boolean;
    gender: Gender;
    restTime: bigint;
}
export enum Gender {
    other = "other",
    female = "female",
    male = "male"
}
export enum TrainingFrequency {
    threeDays = "threeDays",
    fiveDays = "fiveDays",
    fourDays = "fourDays"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum WeightUnit {
    kg = "kg",
    lb = "lb"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    debugGetExerciseCounts(): Promise<Array<[string, bigint]>>;
    generateFullBodyWorkout(): Promise<Result_7>;
    /**
     * / unified check for empty and core-only workouts after all groups built
     */
    generateLowerBodyWorkout(): Promise<Result_7>;
    generateUpperBodyWorkout(): Promise<Result_7>;
    getAlternativeExercises(muscleGroup: string): Promise<Result_6>;
    getCallerUserProfile(): Promise<Result_3>;
    getCallerUserRole(): Promise<UserRole>;
    getLegSubgroupRecovery(): Promise<Result_5>;
    getRecoveryState(): Promise<Result_4>;
    getUserProfile(user: Principal): Promise<Result_3>;
    getWorkoutHistory(): Promise<Result_2>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    isTestRecoveryModeEnabled(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<Result_1>;
    saveWorkout(workout: Workout): Promise<Result_1>;
    updateSuggestedWeightDuringSession(exerciseName: string, weight: number, reps: bigint): Promise<Result>;
}
