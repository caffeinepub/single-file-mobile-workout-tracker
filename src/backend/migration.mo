import Map "mo:core/Map";
import Principal "mo:core/Principal";
import List "mo:core/List";

module {
  type RecoveryState = {
    chest : { lastTrained : Int; recoveryPercentage : Float };
    back : { lastTrained : Int; recoveryPercentage : Float };
    shoulders : { lastTrained : Int; recoveryPercentage : Float };
    arms : { lastTrained : Int; recoveryPercentage : Float };
    core : { lastTrained : Int; recoveryPercentage : Float };
    quadsRecovery : { lastTrained : Int; recoveryPercentage : Float };
    hamstringsRecovery : { lastTrained : Int; recoveryPercentage : Float };
    glutesRecovery : { lastTrained : Int; recoveryPercentage : Float };
    calvesRecovery : { lastTrained : Int; recoveryPercentage : Float };
  };

  type OldActor = {
    userProfiles : Map.Map<Principal, { gender : { #male; #female; #other }; bodyweight : Float; weightUnit : { #kg; #lb }; trainingFrequency : { #threeDays; #fourDays; #fiveDays }; darkMode : Bool; restTime : Int; muscleGroupRestInterval : Int }>;
    workoutHistory : Map.Map<Principal, List.List<{ exercises : [WorkoutExercise]; timestamp : Int; totalVolume : Float }>>;
    recoveryState : Map.Map<Principal, RecoveryState>;
    workoutSummaries : Map.Map<Principal, List.List<{
      date : Int;
      exercises : [Text];
    }>>;
    exerciseChanges : Map.Map<Principal, List.List<{ originalExercise : Text; alternativeExercise : Text; timestamp : Int }>>;
    setConfigurations : Map.Map<Principal, Map.Map<Text, { weight : Float; reps : Nat; sets : Nat }>>;
    upperBodyLimits : Map.Map<Text, Int>;
    lowerBodyLimits : Map.Map<Text, Nat>;
    upperMuscleGroups : [Text];
    lowerMuscleGroups : [Text];
    coreMuscleGroup : Text;
    stableState : ?{
      var userProfiles : [(Principal, { gender : { #male; #female; #other }; bodyweight : Float; weightUnit : { #kg; #lb }; trainingFrequency : { #threeDays; #fourDays; #fiveDays }; darkMode : Bool; restTime : Int; muscleGroupRestInterval : Int })];
      var workoutHistory : [(Principal, [{ exercises : [WorkoutExercise]; timestamp : Int; totalVolume : Float }])];
      var recoveryState : [(Principal, RecoveryState)];
      var workoutSummaries : [(Principal, [{
        date : Int;
        exercises : [Text];
      }])];
      var exerciseChanges : [(Principal, [{ originalExercise : Text; alternativeExercise : Text; timestamp : Int }])];
      var setConfigurations : [(Principal, [(Text, { weight : Float; reps : Nat; sets : Nat })])];
    };
  };

  type WorkoutExercise = {
    exercise : {
      name : Text;
      primaryMuscleGroup : Text;
      equipmentType : Text;
      demoUrl : Text;
      recoveryTime : Int;
    };
    sets : Nat;
    reps : Nat;
    suggestedWeight : Float;
    setData : [{ weight : Float; reps : Nat }];
  };

  type NewActor = {
    userProfiles : Map.Map<Principal, { gender : { #male; #female; #other }; bodyweight : Float; weightUnit : { #kg; #lb }; trainingFrequency : { #threeDays; #fourDays; #fiveDays }; darkMode : Bool; restTime : Int; muscleGroupRestInterval : Int }>;
    workoutHistory : Map.Map<Principal, List.List<{ exercises : [WorkoutExercise]; timestamp : Int; totalVolume : Float }>>;
    recoveryState : Map.Map<Principal, RecoveryState>;
    exerciseChanges : Map.Map<Principal, List.List<{ originalExercise : Text; alternativeExercise : Text; timestamp : Int }>>;
    setConfigurations : Map.Map<Principal, Map.Map<Text, { weight : Float; reps : Nat; sets : Nat }>>;
  };

  public func run(old : OldActor) : NewActor {
    {
      userProfiles = old.userProfiles;
      workoutHistory = old.workoutHistory;
      recoveryState = old.recoveryState;
      exerciseChanges = old.exerciseChanges;
      setConfigurations = old.setConfigurations;
    };
  };
};
