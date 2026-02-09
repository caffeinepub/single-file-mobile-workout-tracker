# Specification

## Summary
**Goal:** Fix the invalid Motoko lowercase call in workout grouping so exercises are correctly matched to muscle groups during workout generation.

**Planned changes:**
- In `backend/main.mo`, update `buildShuffledSectionFromArray` to replace the current broken muscle-group filter that uses `e.primaryMuscleGroup.toLower()` with the provided `Text.toLowercase(...)` + `Text.equal(...)` filter, leaving all other logic and debug prints unchanged.

**User-visible outcome:** Workout generation (including Upper Body and Full Body) correctly includes exercises from non-leg muscle groups (e.g., Chest/Back/Shoulders/Arms/Core) when they exist in the exercise library, and the backend compiles without the invalid `toLower()` usage.
