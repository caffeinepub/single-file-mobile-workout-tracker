# Specification

## Summary
**Goal:** Fix backend exercise grouping to be case-insensitive and ensure test mode forces full recovery.

**Planned changes:**
- In `backend/main.mo`, update `buildShuffledSectionFromArrayWithLimit` to filter `groupExercises` using a case-insensitive comparison via `Text.toLowercase(...)` and `Text.equal(...)`.
- In `backend/main.mo`, replace `adjustRecoveryForTestMode` with the provided implementation that sets all muscle groups to 100% recovery using a fully recovered timestamp.
- Keep `TEST_RECOVERY_MODE` present and set to `true`.

**User-visible outcome:** Workout generation and grouping behaves consistently regardless of muscle-group casing, and when test recovery mode is enabled the app behaves as fully recovered for all muscle groups.
