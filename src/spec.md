# Specification

## Summary
**Goal:** Fix workout generation failures by auto-creating a default user profile when missing and ensuring test recovery mode does not block generation.

**Planned changes:**
- In `backend/main.mo`, update `generateLowerBodyWorkout()`, `generateFullBodyWorkout()`, and `generateUpperBodyWorkout()` to create and persist a default `UserProfile` for the caller when `userProfiles.get(caller)` is null, using the provided fallback snippet placed at the top of each function (immediately after the caller check).
- In `backend/main.mo`, when `TEST_RECOVERY_MODE` is true, bypass access-control permission denials encountered during workout generation so these generate endpoints proceed instead of returning unauthorized errors.
- In `backend/main.mo`, remove/avoid any trapping/aborting behavior in test-mode recovery/exercise-count logic so test mode returns valid exercise counts and generation can produce a non-empty exercise list when matching exercises exist.
- Keep `TEST_RECOVERY_MODE` set to `true`, and produce a new draft containing only these functional fixes (no unrelated logic changes and no new logging).

**User-visible outcome:** Users can generate Full Body, Upper Body, and Lower Body workouts even if they have no existing profile (a default profile is created automatically), and in test recovery mode generation proceeds without access-control or recovery logic blockers.
