import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Text "mo:core/Text";

module {
  type Gender = { #male; #female; #other };
  type WeightUnit = { #kg; #lb };
  type TrainingFrequency = { #threeDays; #fourDays; #fiveDays };

  type Exercise = {
    name : Text;
    primaryMuscleGroup : Text;
    equipmentType : Text;
    demoUrl : Text;
    recoveryTime : Int;
  };

  type WorkoutExercise = {
    exercise : Exercise;
    sets : Nat;
    reps : Nat;
    suggestedWeight : Float;
    setData : [SetData];
  };

  type Workout = {
    exercises : [WorkoutExercise];
    timestamp : Int;
    totalVolume : Float;
  };

  type SetData = { weight : Float; reps : Nat };

  type MuscleRecovery = { lastTrained : Int; recoveryPercentage : Float };
  type RecoveryState = {
    chest : MuscleRecovery;
    back : MuscleRecovery;
    shoulders : MuscleRecovery;
    arms : MuscleRecovery;
    core : MuscleRecovery;
    quadsRecovery : MuscleRecovery;
    hamstringsRecovery : MuscleRecovery;
    glutesRecovery : MuscleRecovery;
    calvesRecovery : MuscleRecovery;
  };

  type ExerciseChange = {
    originalExercise : Text;
    alternativeExercise : Text;
    timestamp : Int;
  };

  type SetConfiguration = { weight : Float; reps : Nat; sets : Nat };
  type UserProfile = {
    gender : Gender;
    bodyweight : Float;
    weightUnit : WeightUnit;
    trainingFrequency : TrainingFrequency;
    darkMode : Bool;
    restTime : Int;
    muscleGroupRestInterval : Int;
  };

  type OldActor = {
    shuffleCounter : Nat;
    userProfiles : Map.Map<Principal, UserProfile>;
    workoutHistory : Map.Map<Principal, List.List<Workout>>;
    recoveryState : Map.Map<Principal, RecoveryState>;
    exerciseChanges : Map.Map<Principal, List.List<ExerciseChange>>;
    setConfigurations : Map.Map<Principal, Map.Map<Text, SetConfiguration>>;
    TEST_RECOVERY_MODE : Bool;
  };

  type NewActor = {
    shuffleCounter : Nat;
    userProfiles : Map.Map<Principal, UserProfile>;
    workoutHistory : Map.Map<Principal, List.List<Workout>>;
    recoveryState : Map.Map<Principal, RecoveryState>;
    exerciseChanges : Map.Map<Principal, List.List<ExerciseChange>>;
    setConfigurations : Map.Map<Principal, Map.Map<Text, SetConfiguration>>;
  };

  public func run(old : OldActor) : NewActor {
    old;
  };
};
