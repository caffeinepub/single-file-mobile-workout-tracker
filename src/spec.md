# Specification

## Summary
**Goal:** Fix the Motoko case-insensitive muscle-group filter so workout generation selects exercises from the correct muscle group.

**Planned changes:**
- In `backend/main.mo` within `buildShuffledSectionFromArray`, replace the existing `let groupExercises = exercises.filter(...)` block with the provided Motoko code using `Text.toLowercase` and `Text.equal`.
- Trigger a new successful draft build after applying the backend change.

**User-visible outcome:** Generating workouts (e.g., “Lower Body”) returns exercises from the intended muscle groups rather than incorrectly matching (such as returning only Core exercises).
