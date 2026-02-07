# Specification

## Summary
**Goal:** Fix lower-body workout note messaging and remove a duplicated empty-check in `generateLowerBodyWorkout()`.

**Planned changes:**
- Update `backend/main.mo` `generateLowerBodyWorkout()` to use the exact 4-branch note decision tree and strings based on `cappedExercises.size()` and `totalLegCount`.
- Remove the first/duplicate early-return empty-check block in `generateLowerBodyWorkout()` that checks `totalExerciseCount == 0`, keeping remaining logic unchanged.

**User-visible outcome:** Lower-body workout generation shows the correct, consistent note text (one of four exact messages) and avoids duplicated empty-check behavior.
