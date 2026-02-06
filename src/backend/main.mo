import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";
import Iter "mo:core/Iter";
import Debug "mo:core/Debug";
import Runtime "mo:core/Runtime";

actor {
  let TEST_RECOVERY_MODE = true;
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
  public type MuscleRecovery = { lastTrained : Int; recoveryPercentage : Float };
  public type RecoveryState = {
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
  type WorkoutSummary = { date : Int; exercises : [Text] };
  type ExerciseChange = {
    originalExercise : Text;
    alternativeExercise : Text;
    timestamp : Int;
  };
  type SetConfiguration = { weight : Float; reps : Nat; sets : Nat };
  type AppError = {
    #unauthorized : Text;
    #adminOnly : Text;
    #userNotFound : Text;
    #internalError : Text;
    #badArguments : Text;
    #userProfileNotFound : Text;
    #optimizationFailed : Text;
  };
  public type Result<Ok> = { #ok : Ok; #err : AppError };
  type StableState = {
    var userProfiles : [(Principal, UserProfile)];
    var workoutHistory : [(Principal, [Workout])];
    var recoveryState : [(Principal, RecoveryState)];
    var workoutSummaries : [(Principal, [WorkoutSummary])];
    var exerciseChanges : [(Principal, [ExerciseChange])];
    var setConfigurations : [(Principal, [(Text, SetConfiguration)])];
  };
  public type UserProfile = {
    gender : Gender;
    bodyweight : Float;
    weightUnit : WeightUnit;
    trainingFrequency : TrainingFrequency;
    darkMode : Bool;
    restTime : Int;
    muscleGroupRestInterval : Int;
  };
  type WorkoutWithNote = {
    exercises : [WorkoutExercise];
    timestamp : Int;
    totalVolume : Float;
    note : Text;
  };

  let upperBodyLimits = Map.fromArray<Text, Int>([
    ("Chest", 4), ("Shoulders", 4), ("Arms", 4), ("Core", 3), ("Back", 2)
  ]);
  let lowerBodyLimits = Map.fromArray<Text, Nat>([
    ("Quads", 3), ("Hamstrings", 3), ("Glutes", 3), ("Calves", 2), ("Core", 3)
  ]);
  let upperMuscleGroups = ["Chest", "Back", "Shoulders", "Arms"];
  let lowerMuscleGroups = ["Quads", "Hamstrings", "Glutes", "Calves"];
  let coreMuscleGroup = "Core";
  let exerciseLibrary : [Exercise] = [
    { name = "Barbell Squats"; primaryMuscleGroup = "Quads"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/barbell-squat"; recoveryTime = 72 },
    { name = "Romanian Deadlifts"; primaryMuscleGroup = "Hamstrings"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/romanian-deadlift"; recoveryTime = 72 },
    { name = "Bulgarian Split Squats"; primaryMuscleGroup = "Quads"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/bulgarian-split-squat"; recoveryTime = 72 },
    { name = "Leg Curls"; primaryMuscleGroup = "Hamstrings"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/leg-curl"; recoveryTime = 72 },
    { name = "Leg Extensions"; primaryMuscleGroup = "Quads"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/leg-extension"; recoveryTime = 72 },
    { name = "Hip Thrusts"; primaryMuscleGroup = "Glutes"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/barbell-hip-thrust"; recoveryTime = 72 },
    { name = "Glute Bridges"; primaryMuscleGroup = "Glutes"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/glute-bridge"; recoveryTime = 72 },
    { name = "Standing Calf Raises"; primaryMuscleGroup = "Calves"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/standing-calf-raise"; recoveryTime = 72 },
    { name = "Seated Calf Raises"; primaryMuscleGroup = "Calves"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/seated-calf-raise"; recoveryTime = 72 },
    { name = "Goblet Squats"; primaryMuscleGroup = "Quads"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/goblet-squat"; recoveryTime = 72 },
    { name = "Walking Lunges"; primaryMuscleGroup = "Quads"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/walking-lunge"; recoveryTime = 72 },
    { name = "Stiff-Leg Deadlifts"; primaryMuscleGroup = "Hamstrings"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/stiff-leg-deadlift"; recoveryTime = 72 },
    { name = "Good Mornings"; primaryMuscleGroup = "Hamstrings"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/good-morning"; recoveryTime = 72 },
    { name = "Cable Kickbacks"; primaryMuscleGroup = "Glutes"; equipmentType = "Cable"; demoUrl = "https://www.muscleandstrength.com/exercises/cable-glute-kickback"; recoveryTime = 72 },
    { name = "Sumo Deadlifts"; primaryMuscleGroup = "Glutes"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/sumo-deadlift"; recoveryTime = 72 },
    { name = "Donkey Calf Raises"; primaryMuscleGroup = "Calves"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/donkey-calf-raise"; recoveryTime = 72 },
    { name = "Single-Leg Calf Raises"; primaryMuscleGroup = "Calves"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/single-leg-calf-raise"; recoveryTime = 72 },
    { name = "Planks"; primaryMuscleGroup = "Core"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/plank"; recoveryTime = 48 },
    { name = "Crunches"; primaryMuscleGroup = "Core"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/crunch"; recoveryTime = 48 },
    { name = "Russian Twists"; primaryMuscleGroup = "Core"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/russian-twist"; recoveryTime = 48 },
    { name = "Leg Raises"; primaryMuscleGroup = "Core"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/leg-raise"; recoveryTime = 48 },
    { name = "Cable Crunches"; primaryMuscleGroup = "Core"; equipmentType = "Cable"; demoUrl = "https://www.muscleandstrength.com/exercises/cable-crunch"; recoveryTime = 48 },
    { name = "Ab Wheel Rollouts"; primaryMuscleGroup = "Core"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/ab-wheel-rollout"; recoveryTime = 48 },
    { name = "Mountain Climbers"; primaryMuscleGroup = "Core"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/mountain-climber"; recoveryTime = 48 },
    { name = "Bench Press"; primaryMuscleGroup = "Chest"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/bench-press"; recoveryTime = 72 },
    { name = "Incline Bench Press"; primaryMuscleGroup = "Chest"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/incline-bench-press"; recoveryTime = 72 },
    { name = "Chest Flys"; primaryMuscleGroup = "Chest"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/dumbbell-fly"; recoveryTime = 72 },
    { name = "Push-Ups"; primaryMuscleGroup = "Chest"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/push-up"; recoveryTime = 72 },
    { name = "Pull-Ups"; primaryMuscleGroup = "Back"; equipmentType = "Bodyweight"; demoUrl = "https://www.muscleandstrength.com/exercises/pull-up"; recoveryTime = 72 },
    { name = "Barbell Rows"; primaryMuscleGroup = "Back"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/barbell-row"; recoveryTime = 72 },
    { name = "Lat Pulldowns"; primaryMuscleGroup = "Back"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/lat-pulldown"; recoveryTime = 72 },
    { name = "Seated Rows"; primaryMuscleGroup = "Back"; equipmentType = "Machine"; demoUrl = "https://www.muscleandstrength.com/exercises/seated-row"; recoveryTime = 72 },
    { name = "Shoulder Press"; primaryMuscleGroup = "Shoulders"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/barbell-shoulder-press"; recoveryTime = 72 },
    { name = "Lateral Raises"; primaryMuscleGroup = "Shoulders"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/lateral-raise"; recoveryTime = 72 },
    { name = "Front Raises"; primaryMuscleGroup = "Shoulders"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/front-raise"; recoveryTime = 72 },
    { name = "Arnold Press"; primaryMuscleGroup = "Shoulders"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/arnold-press"; recoveryTime = 72 },
    { name = "Bicep Curls"; primaryMuscleGroup = "Arms"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/dumbbell-curl"; recoveryTime = 72 },
    { name = "Tricep Extensions"; primaryMuscleGroup = "Arms"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/dumbbell-tricep-extension"; recoveryTime = 72 },
    { name = "Hammer Curls"; primaryMuscleGroup = "Arms"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/hammer-curl"; recoveryTime = 72 },
    { name = "Tricep Pushdowns"; primaryMuscleGroup = "Arms"; equipmentType = "Cable"; demoUrl = "https://www.muscleandstrength.com/exercises/cable-tricep-pushdown"; recoveryTime = 72 },
    { name = "Barbell Curls"; primaryMuscleGroup = "Arms"; equipmentType = "Barbell"; demoUrl = "https://www.muscleandstrength.com/exercises/barbell-curl"; recoveryTime = 72 },
    { name = "Reverse Flys"; primaryMuscleGroup = "Shoulders"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/reverse-fly"; recoveryTime = 72 },
    { name = "Face Pulls"; primaryMuscleGroup = "Shoulders"; equipmentType = "Cable"; demoUrl = "https://www.muscleandstrength.com/exercises/cable-face-pull"; recoveryTime = 72 },
    { name = "Incline Curls"; primaryMuscleGroup = "Arms"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/incline-dumbbell-curl"; recoveryTime = 72 },
    { name = "Overhead Tricep Extension"; primaryMuscleGroup = "Arms"; equipmentType = "Dumbbell"; demoUrl = "https://www.muscleandstrength.com/exercises/overhead-tricep-extension"; recoveryTime = 72 },
    {
      name = "Dumbbell Bench Press";
      primaryMuscleGroup = "Chest";
      equipmentType = "Dumbbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/dumbbell-bench-press";
      recoveryTime = 72;
    },
    {
      name = "Decline Bench Press";
      primaryMuscleGroup = "Chest";
      equipmentType = "Barbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/decline-bench-press";
      recoveryTime = 72;
    },
    {
      name = "Incline Dumbbell Press";
      primaryMuscleGroup = "Chest";
      equipmentType = "Dumbbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/incline-dumbbell-press";
      recoveryTime = 72;
    },
    {
      name = "Cable Crossovers";
      primaryMuscleGroup = "Chest";
      equipmentType = "Cable";
      demoUrl = "https://www.muscleandstrength.com/exercises/cable-crossover";
      recoveryTime = 72;
    },
    {
      name = "Chest Dips";
      primaryMuscleGroup = "Chest";
      equipmentType = "Bodyweight";
      demoUrl = "https://www.muscleandstrength.com/exercises/dip";
      recoveryTime = 72;
    },
    {
      name = "Machine Chest Press";
      primaryMuscleGroup = "Chest";
      equipmentType = "Machine";
      demoUrl = "https://www.muscleandstrength.com/exercises/machine-chest-press";
      recoveryTime = 72;
    },
    {
      name = "Svend Press";
      primaryMuscleGroup = "Chest";
      equipmentType = "Plate";
      demoUrl = "https://www.muscleandstrength.com/exercises/svend-press";
      recoveryTime = 72;
    },
    {
      name = "Wide Grip Push-Ups";
      primaryMuscleGroup = "Chest";
      equipmentType = "Bodyweight";
      demoUrl = "https://www.muscleandstrength.com/exercises/wide-grip-push-up";
      recoveryTime = 72;
    },
    {
      name = "Deadlift";
      primaryMuscleGroup = "Back";
      equipmentType = "Barbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/barbell-deadlift";
      recoveryTime = 72;
    },
    {
      name = "Bent Over Row";
      primaryMuscleGroup = "Back";
      equipmentType = "Barbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/barbell-bent-over-row";
      recoveryTime = 72;
    },
    {
      name = "T-Bar Row";
      primaryMuscleGroup = "Back";
      equipmentType = "Barbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/t-bar-row";
      recoveryTime = 72;
    },
    {
      name = "Single Arm Dumbbell Row";
      primaryMuscleGroup = "Back";
      equipmentType = "Dumbbell";
      demoUrl = "https://www.muscleandstrength.com/exercises/single-arm-dumbbell-row";
      recoveryTime = 72;
    },
    {
      name = "Straight Arm Pulldown";
      primaryMuscleGroup = "Back";
      equipmentType = "Cable";
      demoUrl = "https://www.muscleandstrength.com/exercises/straight-arm-pulldown";
      recoveryTime = 72;
    }
  ];
  var shuffleCounter : Nat = 0;
  var stableState : ?StableState = null;
  let accessControlState = AccessControl.initState();
  var userProfiles : Map.Map<Principal, UserProfile> = Map.empty();
  var workoutHistory : Map.Map<Principal, List.List<Workout>> = Map.empty();
  var recoveryState : Map.Map<Principal, RecoveryState> = Map.empty();
  var workoutSummaries : Map.Map<Principal, List.List<WorkoutSummary>> = Map.empty();
  var exerciseChanges : Map.Map<Principal, List.List<ExerciseChange>> = Map.empty();
  var setConfigurations : Map.Map<Principal, Map.Map<Text, SetConfiguration>> = Map.empty();

  func toF(x : Int) : Float { x.toFloat() };
  func toLower(t : Text) : Text {
    let chars = t.chars();
    let lowerChars = chars.map(func(c : Char) : Char {
      let code = c.toNat32();
      if (code >= 65 and code <= 90) {
        Char.fromNat32(code + 32);
      } else {
        c;
      }
    });
    Text.fromIter(lowerChars);
  };

  func calculateLegsFromSubgroups(
    quads : MuscleRecovery,
    hamstrings : MuscleRecovery,
    glutes : MuscleRecovery,
    calves : MuscleRecovery
  ) : MuscleRecovery {
    let latest = Int.max(
      quads.lastTrained,
      Int.max(hamstrings.lastTrained, Int.max(glutes.lastTrained, calves.lastTrained)),
    );
    let weightedRecovery = quads.recoveryPercentage * 0.38 +
      hamstrings.recoveryPercentage * 0.22 +
      glutes.recoveryPercentage * 0.30 +
      calves.recoveryPercentage * 0.10;
    let clampedRecovery = Float.min(100.0, Float.max(0.0, weightedRecovery));
    { lastTrained = latest; recoveryPercentage = clampedRecovery };
  };

  func getExerciseCountForGroup(group : Text, recovery : RecoveryState) : Nat {
    if (TEST_RECOVERY_MODE) {
      Debug.print("Test recovery mode active - all groups fully recovered");
      return if (group == "Core") { 2 } else { 2 };
    };
    switch (group) {
      case ("Quads") {
        let recoveryPct = recovery.quadsRecovery.recoveryPercentage;
        if (recoveryPct >= 80.0) { 2 }
        else if (recoveryPct >= 50.0) { 1 }
        else { 0 };
      };
      case ("Hamstrings") {
        let recoveryPct = recovery.hamstringsRecovery.recoveryPercentage;
        if (recoveryPct >= 80.0) { 2 }
        else if (recoveryPct >= 50.0) { 1 }
        else { 0 };
      };
      case ("Glutes") {
        let recoveryPct = recovery.glutesRecovery.recoveryPercentage;
        if (recoveryPct >= 80.0) { 2 }
        else if (recoveryPct >= 50.0) { 1 }
        else { 0 };
      };
      case ("Calves") {
        let recoveryPct = recovery.calvesRecovery.recoveryPercentage;
        if (recoveryPct >= 80.0) { 2 }
        else if (recoveryPct >= 50.0) { 1 }
        else { 0 };
      };
      case ("Chest" or "Back" or "Shoulders" or "Arms") {
        if (calculateRecoveryPercentage(getLastTrained(group, recovery), 72) >= 65.0) { 2 } else { 0 };
      };
      case ("Core") { 2 };
      case (_) { 0 };
    };
  };

  public query ({ caller }) func debugGetExerciseCounts() : async [(Text, Nat)] {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can access debug functions");
    };
    let groups = ["Quads", "Hamstrings", "Glutes", "Calves", "Core", "Chest", "Back", "Shoulders", "Arms"];
    groups.map<Text, (Text, Nat)>(func(group) {
      let count = exerciseLibrary.filter(func(e) { e.primaryMuscleGroup == group }).size();
      (group, count)
    });
  };

  public query ({ caller }) func getRecoveryState() : async Result<{
    chest : MuscleRecovery;
    back : MuscleRecovery;
    legs : MuscleRecovery;
    shoulders : MuscleRecovery;
    arms : MuscleRecovery;
    core : MuscleRecovery;
    quadsRecovery : MuscleRecovery;
    hamstringsRecovery : MuscleRecovery;
    glutesRecovery : MuscleRecovery;
    calvesRecovery : MuscleRecovery;
  }> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can view recovery state"));
    };
    let state = switch (recoveryState.get(caller)) {
      case (null) { getDefaultRecoveryState() };
      case (?r) { refreshAllRecoveryPercentages(r) };
    };
    #ok({
      state with
      legs = calculateLegsFromSubgroups(
        state.quadsRecovery, state.hamstringsRecovery, state.glutesRecovery, state.calvesRecovery
      );
    });
  };

  public query ({ caller }) func getLegSubgroupRecovery() : async Result<{
    quads : MuscleRecovery;
    hamstrings : MuscleRecovery;
    glutes : MuscleRecovery;
    calves : MuscleRecovery;
    legs : MuscleRecovery;
  }> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can view recovery state"));
    };
    let state = switch (recoveryState.get(caller)) {
      case (null) { getDefaultRecoveryState() };
      case (?r) { refreshAllRecoveryPercentages(r) };
    };
    #ok({
      quads = state.quadsRecovery;
      hamstrings = state.hamstringsRecovery;
      glutes = state.glutesRecovery;
      calves = state.calvesRecovery;
      legs = calculateLegsFromSubgroups(
        state.quadsRecovery, state.hamstringsRecovery, state.glutesRecovery, state.calvesRecovery
      );
    });
  };

  public query ({ caller }) func isTestRecoveryModeEnabled() : async Bool {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return false;
    };
    TEST_RECOVERY_MODE;
  };

  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can assign roles");
    };
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async Result<?UserProfile> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only users can view profiles"));
    };
    #ok(userProfiles.get(caller));
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async Result<?UserProfile> {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      return #err(#unauthorized("Can only view your own profile unless you are an admin"));
    };
    #ok(userProfiles.get(user));
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async Result<()> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only users can save profiles"));
    };
    userProfiles.add(caller, profile);
    #ok(());
  };

  func uniqueByName(exercises : [WorkoutExercise]) : [WorkoutExercise] {
    let seen = Map.empty<Text, Bool>();
    let builder = List.empty<WorkoutExercise>();

    for (exercise in exercises.vals()) {
      let name = exercise.exercise.name;
      Debug.print("Checking exercise: " # name);

      switch (seen.get(name)) {
        case (?_) {
          Debug.print("Skipping duplicate: " # name);
        };
        case (null) {
          seen.add(name, true);
          builder.add(exercise);
        };
      };
    };

    builder.toArray();
  };

  public shared ({ caller }) func saveWorkout(workout : Workout) : async Result<()> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can save workouts"));
    };

    let history = switch (workoutHistory.get(caller)) {
      case (null) { List.empty<Workout>() };
      case (?h) { h };
    };
    history.add(workout);
    workoutHistory.add(caller, history);

    let currentRecovery = switch (recoveryState.get(caller)) {
      case (null) { getDefaultRecoveryState() };
      case (?r) { r };
    };

    let freshRecovery = refreshAllRecoveryPercentages(currentRecovery);

    let updatedChest = updateMuscleRecovery(freshRecovery.chest, workout, ["Chest"], 72);
    let updatedBack = updateMuscleRecovery(freshRecovery.back, workout, ["Back"], 72);
    let updatedShoulders = updateMuscleRecovery(freshRecovery.shoulders, workout, ["Shoulders"], 72);
    let updatedArms = updateMuscleRecovery(freshRecovery.arms, workout, ["Arms"], 72);
    let updatedCore = updateMuscleRecovery(freshRecovery.core, workout, ["Core"], 48);
    let updatedQuads = updateMuscleRecovery(freshRecovery.quadsRecovery, workout, ["Quads"], 72);
    let updatedHamstrings = updateMuscleRecovery(freshRecovery.hamstringsRecovery, workout, ["Hamstrings"], 72);
    let updatedGlutes = updateMuscleRecovery(freshRecovery.glutesRecovery, workout, ["Glutes"], 72);
    let updatedCalves = updateMuscleRecovery(freshRecovery.calvesRecovery, workout, ["Calves"], 72);

    let updatedRecovery : RecoveryState = {
      chest = updatedChest;
      back = updatedBack;
      shoulders = updatedShoulders;
      arms = updatedArms;
      core = updatedCore;
      quadsRecovery = updatedQuads;
      hamstringsRecovery = updatedHamstrings;
      glutesRecovery = updatedGlutes;
      calvesRecovery = updatedCalves;
    };

    recoveryState.add(caller, updatedRecovery);
    #ok(());
  };

  func updateMuscleRecovery(
    existingRecovery : MuscleRecovery,
    workout : Workout,
    muscleGroups : [Text],
    recoveryTime : Int,
  ) : MuscleRecovery {
    let now = Time.now();
    let targetsGroup = workout.exercises.any(func(e) {
      muscleGroups.any(func(group) { group == e.exercise.primaryMuscleGroup });
    });
    if (targetsGroup) {
      { lastTrained = now; recoveryPercentage = 0.0 };
    } else {
      {
        lastTrained = existingRecovery.lastTrained;
        recoveryPercentage = calculateRecoveryPercentage(existingRecovery.lastTrained, recoveryTime);
      };
    };
  };

  func calculateRecoveryPercentage(lastTrained : Int, recoveryTimeHours : Int) : Float {
    let now = Time.now();
    let elapsedNanos = now - lastTrained;
    let elapsedHours = toF(elapsedNanos) / toF(3_600_000_000_000 : Int);
    let percentage = Float.min(100.0, (elapsedHours / toF(recoveryTimeHours)) * 100.0);
    percentage;
  };

  func getLastTrained(group : Text, recovery : RecoveryState) : Int {
    switch (group) {
      case ("Chest") { recovery.chest.lastTrained };
      case ("Back") { recovery.back.lastTrained };
      case ("Shoulders") { recovery.shoulders.lastTrained };
      case ("Arms") { recovery.arms.lastTrained };
      case ("Core") { recovery.core.lastTrained };
      case ("Quads") { recovery.quadsRecovery.lastTrained };
      case ("Hamstrings") { recovery.hamstringsRecovery.lastTrained };
      case ("Glutes") { recovery.glutesRecovery.lastTrained };
      case ("Calves") { recovery.calvesRecovery.lastTrained };
      case (_) { Time.now() };
    };
  };

  func refreshAllRecoveryPercentages(existing : RecoveryState) : RecoveryState {
    if (TEST_RECOVERY_MODE) {
      let fullRecovery : MuscleRecovery = {
        lastTrained = existing.chest.lastTrained;
        recoveryPercentage = 100.0;
      };
      return {
        chest = fullRecovery;
        back = fullRecovery;
        shoulders = fullRecovery;
        arms = fullRecovery;
        core = fullRecovery;
        quadsRecovery = fullRecovery;
        hamstringsRecovery = fullRecovery;
        glutesRecovery = fullRecovery;
        calvesRecovery = fullRecovery;
      };
    };
    {
      chest = { existing.chest with recoveryPercentage = calculateRecoveryPercentage(existing.chest.lastTrained, 72) };
      back = { existing.back with recoveryPercentage = calculateRecoveryPercentage(existing.back.lastTrained, 72) };
      shoulders = {
        existing.shoulders with recoveryPercentage = calculateRecoveryPercentage(existing.shoulders.lastTrained, 72)
      };
      arms = { existing.arms with recoveryPercentage = calculateRecoveryPercentage(existing.arms.lastTrained, 72) };
      core = { existing.core with recoveryPercentage = calculateRecoveryPercentage(existing.core.lastTrained, 48) };
      quadsRecovery = {
        existing.quadsRecovery with recoveryPercentage = calculateRecoveryPercentage(existing.quadsRecovery.lastTrained, 72)
      };
      hamstringsRecovery = {
        existing.hamstringsRecovery with recoveryPercentage = calculateRecoveryPercentage(existing.hamstringsRecovery.lastTrained, 72)
      };
      glutesRecovery = {
        existing.glutesRecovery with recoveryPercentage = calculateRecoveryPercentage(existing.glutesRecovery.lastTrained, 72)
      };
      calvesRecovery = {
        existing.calvesRecovery with recoveryPercentage = calculateRecoveryPercentage(existing.calvesRecovery.lastTrained, 72)
      };
    };
  };

  func buildShuffledSectionFromArray(
    caller : Principal,
    profile : UserProfile,
    exercises : [Exercise],
    group : Text,
    groupLimit : Nat
  ) : [WorkoutExercise] {
    Debug.print("DEBUG-BUILD: Building for group=" # group # ", input exercises size=" # exercises.size().toText());
    let groupExercises = exercises.filter(func(e) {
      let matches = toLower(e.primaryMuscleGroup) == toLower(group);
      if (matches) {
        Debug.print("DEBUG-MATCH: " # e.name # " matches " # group);
      } else {
        Debug.print("DEBUG-NO-MATCH: " # e.name # " group=" # e.primaryMuscleGroup # " != " # group);
      };
      matches
    });
    Debug.print("DEBUG-BUILD: Filtered to " # groupExercises.size().toText() # " exercises for " # group);

    let shuffledGroup = shuffleArray(groupExercises, caller);
    let count = Nat.min(shuffledGroup.size(), groupLimit);
    let selected = if (shuffledGroup.size() > count) {
      Array.tabulate(count, func(i) { shuffledGroup[i] });
    } else { shuffledGroup };
    let mapped = selected.map(
      func(e) {
        let (sets, reps) = calculateSetsAndReps(profile);
        let suggestedWeight = calculateSuggestedWeight(e, profile);
        {
          exercise = e;
          sets;
          reps;
          suggestedWeight;
          setData = [];
        };
      }
    );
    mapped;
  };

  func calculateSetsAndReps(profile : UserProfile) : (Nat, Nat) {
    let sets = switch (profile.trainingFrequency) {
      case (#threeDays) { 4 };
      case (#fourDays) { 3 };
      case (#fiveDays) { 3 };
    };
    let reps = 10;
    (sets, reps);
  };

  func calculateSuggestedWeight(exercise : Exercise, profile : UserProfile) : Float {
    let baseWeight = switch (profile.gender) {
      case (#male) { profile.bodyweight * 0.5 };
      case (#female) { profile.bodyweight * 0.35 };
      case (#other) { profile.bodyweight * 0.4 };
    };
    let muscleMultiplier = switch (exercise.primaryMuscleGroup) {
      case ("Quads") { 1.3 };
      case ("Hamstrings") { 1.25 };
      case ("Glutes") { 1.1 };
      case ("Calves") { 1.1 };
      case ("Core") { 0.3 };
      case (_) { 1.0 };
    };
    let equipmentMultiplier = switch (exercise.equipmentType) {
      case ("Barbell") { 1.2 };
      case ("Dumbbell") { 0.8 };
      case ("Machine") { 1.0 };
      case ("Cable") { 0.9 };
      case ("Bodyweight") { 0.0 };
      case ("Band") { 0.4 };
      case (_) { 0.8 };
    };
    let weight = baseWeight * muscleMultiplier * equipmentMultiplier;
    Float.max(0.0, weight);
  };

  func principalHash(p : Principal) : Nat {
    let blob = p.toBlob();
    var hash : Nat = 0;
    for (byte in blob.vals()) {
      hash := (hash * 31 + byte.toNat()) % 1_000_000_007;
    };
    hash;
  };

  func shuffleArray<T>(arr : [T], caller : Principal) : [T] {
    let seed = principalHash(caller) + shuffleCounter;
    shuffleCounter += 1;
    let size = arr.size();
    let mutableArr : [var T] = arr.toVarArray();
    var i = size;
    while (i > 1) {
      i -= 1;
      let j = (seed + i) % (i + 1);
      let temp = mutableArr[i];
      mutableArr[i] := mutableArr[j];
      mutableArr[j] := temp;
    };
    Array.tabulate(size, func(idx) { mutableArr[idx] });
  };

  func getDefaultRecoveryState() : RecoveryState {
    let now = Time.now();
    let defaultRecovery : MuscleRecovery = {
      lastTrained = now - (72 * 3_600_000_000_000);
      recoveryPercentage = 100.0;
    };
    {
      chest = defaultRecovery;
      back = defaultRecovery;
      shoulders = defaultRecovery;
      arms = defaultRecovery;
      core = defaultRecovery;
      quadsRecovery = defaultRecovery;
      hamstringsRecovery = defaultRecovery;
      glutesRecovery = defaultRecovery;
      calvesRecovery = defaultRecovery;
    };
  };

  /// unified check for empty and core-only workouts after all groups built
  public shared ({ caller }) func generateLowerBodyWorkout() : async Result<WorkoutWithNote> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can generate workouts"));
    };

    let profile = switch (userProfiles.get(caller)) {
      case (null) { return #err(#userProfileNotFound("User profile not found")) };
      case (?p) { p };
    };

    let currentRecovery = switch (recoveryState.get(caller)) {
      case (null) { getDefaultRecoveryState() };
      case (?r) { refreshAllRecoveryPercentages(r) };
    };

    let quadsRequestedCount = getExerciseCountForGroup("Quads", currentRecovery);
    let hamstringsRequestedCount = getExerciseCountForGroup("Hamstrings", currentRecovery);
    let glutesRequestedCount = getExerciseCountForGroup("Glutes", currentRecovery);
    let calvesRequestedCount = getExerciseCountForGroup("Calves", currentRecovery);
    let coreRequestedCount = getExerciseCountForGroup("Core", currentRecovery);

    let quadsSection = buildShuffledSectionFromArray(
      caller, profile, exerciseLibrary, "Quads", quadsRequestedCount
    );
    Debug.print("DEBUG: Quads requested: " # quadsRequestedCount.toText() # " selected: " # quadsSection.size().toText());

    let hamstringsSection = buildShuffledSectionFromArray(
      caller, profile, exerciseLibrary, "Hamstrings", hamstringsRequestedCount
    );
    Debug.print("DEBUG: Hamstrings requested: " # hamstringsRequestedCount.toText() # " selected: " # hamstringsSection.size().toText());

    let glutesSection = buildShuffledSectionFromArray(
      caller, profile, exerciseLibrary, "Glutes", glutesRequestedCount
    );
    Debug.print("DEBUG: Glutes requested: " # glutesRequestedCount.toText() # " selected: " # glutesSection.size().toText());

    let calvesSection = buildShuffledSectionFromArray(
      caller, profile, exerciseLibrary, "Calves", calvesRequestedCount
    );
    Debug.print("DEBUG: Calves requested: " # calvesRequestedCount.toText() # " selected: " # calvesSection.size().toText());

    let coreSection = buildShuffledSectionFromArray(
      caller, profile, exerciseLibrary, "Core", coreRequestedCount
    );

    let totalLegCount = quadsSection.size() + hamstringsSection.size() + glutesSection.size() + calvesSection.size();
    let totalExerciseCount = totalLegCount + coreSection.size();

    if (totalExerciseCount == 0) {
      return #ok({
        exercises = [];
        timestamp = Time.now();
        totalVolume = 0.0;
        note = "All lower muscle groups recovering";
      });
    };

    var allExercises : [WorkoutExercise] = [];
    allExercises := allExercises.concat(quadsSection).concat(hamstringsSection).concat(glutesSection).concat(calvesSection).concat(coreSection);

    Debug.print("DEBUG: Total pre-dedup exercises = " # allExercises.size().toText());

    let finalExercises = uniqueByName(allExercises);
    let finalLegCount = quadsSection.size() + hamstringsSection.size() + glutesSection.size() + calvesSection.size();

    Debug.print("DEBUG: Post-dedup exercises = " # finalExercises.size().toText());
    Debug.print("DEBUG: Post-dedup leg exercises = " # finalLegCount.toText());

    if (finalExercises.size() == 0) {
      return #ok({
        exercises = [];
        timestamp = Time.now();
        totalVolume = 0.0;
        note = "All lower body and core groups recovering";
      });
    };

    let cappedExercises = if (finalExercises.size() > 8) {
      Array.tabulate(8, func(i) { finalExercises[i] });
    } else { finalExercises };
    let totalVolume = cappedExercises.foldLeft(
      0.0,
      func(acc, we) { acc + (toF(we.sets) * toF(we.reps) * we.suggestedWeight) },
    );

    // Logic issue #717
    let note = if (finalLegCount == 0) {
      "Core-focused session";
    } else if (cappedExercises.size() <= 3) {
      "Limited leg exercises due to muscle recovery";
    } else {
      "Full lower-body workout (limited volume)";
    };
    #ok({
      exercises = cappedExercises;
      timestamp = Time.now();
      totalVolume;
      note;
    });
  };

  public shared ({ caller }) func generateFullBodyWorkout() : async Result<WorkoutWithNote> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can generate workouts"));
    };
    let profile = switch (userProfiles.get(caller)) {
      case (null) { return #err(#userProfileNotFound("User profile not found")) };
      case (?p) { p };
    };
    let currentRecovery = switch (recoveryState.get(caller)) {
      case (null) { getDefaultRecoveryState() };
      case (?r) { refreshAllRecoveryPercentages(r) };
    };
    let muscleGroupOrder = [
      "Chest",
      "Back",
      "Shoulders",
      "Arms",
      "Quads",
      "Hamstrings",
      "Glutes",
      "Calves",
      "Core",
    ];
    var allExercises : [WorkoutExercise] = [];
    for (group in muscleGroupOrder.vals()) {
      let limit = getExerciseCountForGroup(group, currentRecovery);
      if (limit > 0) {
        let section = buildShuffledSectionFromArray(caller, profile, exerciseLibrary, group, limit);
        allExercises := allExercises.concat(section);
      };
    };
    allExercises := uniqueByName(allExercises);
    let size = allExercises.size();
    if (size == 0) {
      return #err(#optimizationFailed("All muscle groups are under recovery. Please rest or try again later."));
    };
    let note = if (size < 10) {
      "Reduced volume due to recovery constraints.";
    } else { "" };
    let totalVolume = allExercises.foldLeft(0.0, func(acc, we) {
      acc + (toF(we.sets) * toF(we.reps) * we.suggestedWeight);
    });
    let workout : WorkoutWithNote = {
      exercises = allExercises;
      timestamp = Time.now();
      totalVolume;
      note;
    };
    #ok(workout);
  };

  public shared ({ caller }) func generateUpperBodyWorkout() : async Result<WorkoutWithNote> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can generate workouts"));
    };
    let profile = switch (userProfiles.get(caller)) {
      case (null) { return #err(#userProfileNotFound("User profile not found")) };
      case (?p) { p };
    };
    let currentRecovery = switch (recoveryState.get(caller)) {
      case (null) { getDefaultRecoveryState() };
      case (?r) { refreshAllRecoveryPercentages(r) };
    };
    let muscleGroupOrder = ["Chest", "Back", "Shoulders", "Arms", "Core"];
    var allExercises : [WorkoutExercise] = [];
    for (group in muscleGroupOrder.vals()) {
      let limit = getExerciseCountForGroup(group, currentRecovery);
      if (limit > 0) {
        let section = buildShuffledSectionFromArray(caller, profile, exerciseLibrary, group, limit);
        allExercises := allExercises.concat(section);
      };
    };
    allExercises := uniqueByName(allExercises);
    let size = allExercises.size();
    if (size == 0) {
      return #err(#optimizationFailed("All muscle groups are under recovery. Please rest or try again later."));
    };
    let note = if (size < 10) {
      "Reduced volume due to recovery constraints.";
    } else { "" };
    let totalVolume = allExercises.foldLeft(0.0, func(acc, we) {
      acc + (toF(we.sets) * toF(we.reps) * we.suggestedWeight);
    });
    let workout : WorkoutWithNote = {
      exercises = allExercises;
      timestamp = Time.now();
      totalVolume;
      note;
    };
    #ok(workout);
  };

  public query ({ caller }) func getAlternativeExercises(muscleGroup : Text) : async Result<[Exercise]> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can get alternative exercises"));
    };
    let alternatives = exerciseLibrary.filter(func(e) { toLower(e.primaryMuscleGroup) == toLower(muscleGroup) });
    let shuffled = shuffleArray(alternatives, caller);
    let limited = if (shuffled.size() > 15) {
      Array.tabulate(15, func(i) { shuffled[i] });
    } else { shuffled };
    #ok(limited);
  };

  public query ({ caller }) func getWorkoutHistory() : async Result<[Workout]> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can view workout history"));
    };
    let history = switch (workoutHistory.get(caller)) {
      case (null) { [] };
      case (?h) { h.toArray() };
    };
    #ok(history);
  };

  public shared ({ caller }) func updateSuggestedWeightDuringSession(
    exerciseName : Text, weight : Float, reps : Nat
  ) : async Result<Float> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err(#unauthorized("Only authenticated users can update weights"));
    };
    let newWeight = if (reps > 12) { weight * 1.075 } else if (reps < 6) {
      weight * 0.925;
    } else { weight };
    let userConfigs = switch (setConfigurations.get(caller)) {
      case (null) { Map.empty<Text, SetConfiguration>() };
      case (?configs) { configs };
    };
    let newConfig : SetConfiguration = {
      weight = newWeight;
      reps = 10;
      sets = 3;
    };
    userConfigs.add(exerciseName, newConfig);
    setConfigurations.add(caller, userConfigs);
    #ok(newWeight);
  };

  system func preupgrade() {
    stableState := ?{
      var userProfiles = userProfiles.toArray();
      var workoutHistory = workoutHistory.toArray().map(
        func((k, v)) { (k, v.toArray()) }
      );
      var recoveryState = recoveryState.toArray();
      var workoutSummaries = workoutSummaries.toArray().map(
        func((k, v)) { (k, v.toArray()) }
      );
      var exerciseChanges = exerciseChanges.toArray().map(
        func((k, v)) { (k, v.toArray()) }
      );
      var setConfigurations = setConfigurations.toArray().map(
        func((k, v)) { (k, v.toArray()) }
      );
    };
  };

  system func postupgrade() {
    switch (stableState) {
      case (null) {};
      case (?state) {
        userProfiles.clear();
        for ((k, v) in state.userProfiles.values()) {
          userProfiles.add(k, v);
        };
        workoutHistory.clear();
        for ((k, v) in state.workoutHistory.values()) {
          workoutHistory.add(k, List.fromArray<Workout>(v));
        };
        recoveryState.clear();
        for ((k, v) in state.recoveryState.values()) {
          recoveryState.add(k, v);
        };
        workoutSummaries.clear();
        for ((k, v) in state.workoutSummaries.values()) {
          workoutSummaries.add(k, List.fromArray<WorkoutSummary>(v));
        };
        exerciseChanges.clear();
        for ((k, v) in state.exerciseChanges.values()) {
          exerciseChanges.add(k, List.fromArray<ExerciseChange>(v));
        };
        setConfigurations.clear();
        for ((k, v) in state.setConfigurations.values()) {
          let innerConfigs = v.foldLeft(
            Map.empty<Text, SetConfiguration>(),
            func(acc, (name, config)) {
              acc.add(name, config);
              acc;
            },
          );
          setConfigurations.add(k, innerConfigs);
        };
        stableState := null;
      };
    };
  };
};
