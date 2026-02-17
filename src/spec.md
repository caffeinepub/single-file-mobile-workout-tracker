# Specification

## Summary
**Goal:** Ensure test-mode forces 100% recovery for all muscle groups (including leg subgroups) and add minimal debug logs showing requested exercise counts during Full Body workout generation.

**Planned changes:**
- Replace the entire `adjustRecoveryForTestMode(_caller : Principal) : RecoveryState` implementation in `backend/main.mo` with the provided code block that sets `fullyRecoveredTime` and assigns `recoveryPercentage = 100.0` for chest, back, shoulders, arms, core, quadsRecovery, hamstringsRecovery, glutesRecovery, and calvesRecovery.
- In `backend/main.mo` within `generateFullBodyWorkout`, add exactly five `Debug.print(...)` lines (as provided) to log requested exercise counts for Chest, Quads, Hamstrings, Glutes, and Calves using `getExerciseCountForGroup("<Group>", currentRecovery).toText()`.

**User-visible outcome:** When Full Body workouts are generated, canister logs show the requested exercise counts for the specified groups, and test-mode recovery produces 100% recovery for all listed muscle groups including leg subgroups.
