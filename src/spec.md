# Specification

## Summary
**Goal:** Fix lower-body workout note logic in the backend and ensure Core exercises render in the lower-body workout UI.

**Planned changes:**
- Update `generateLowerBodyWorkout()` in `backend/main.mo` to use the exact 4-branch note decision tree (with the exact English strings), remove the earlier duplicate empty-workout early-return block, and change the limited-workout threshold to `cappedExercises.size() <= 3`.
- Update the frontend lower-body workout rendering component to conditionally render a "Core" subsection after the leg subgroups when any exercises have `exercise.primaryMuscleGroup === "Core"`, inserting the provided JSX exactly.

**User-visible outcome:** Lower-body workouts display the correct note text based on recovery/exercise availability, and Core exercises (when present) appear in a dedicated "Core" section after the leg groups.
