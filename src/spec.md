# Specification

## Summary
**Goal:** Fix Motoko text filtering, ensure test-mode recovery treats all muscle groups as fully recovered, and use real timestamps in generated workouts for Version 359.

**Planned changes:**
- Replace all invalid `.toLower()` usage on Motoko `Text` in `backend/main.mo` with case-insensitive comparisons using `Text.toLowercase` + `Text.equal`, including filters in `buildShuffledSectionFromArray` and `buildShuffledSectionFromArrayWithLimit`.
- Update `adjustRecoveryForTestMode` to force 100% recovery for every muscle group by setting each `RecoveryState` field to `lastTrained = 0 - (100 * 3_600_000_000_000)` and `recoveryPercentage = 100.0`.
- Import `Time` and set workout `timestamp` to `Time.now()` in `generateFullBodyWorkout`, `generateUpperBodyWorkout`, and `generateLowerBodyWorkout`.
- Build and deploy updated draft Version 359 with these backend changes.

**User-visible outcome:** Generated workouts (including Full Body) correctly match muscle groups case-insensitively (including leg subgroups), test recovery mode treats all muscles as fully recovered, and workouts include real timestamps.
