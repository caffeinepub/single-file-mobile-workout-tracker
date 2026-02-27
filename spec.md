# Specification

## Summary
**Goal:** Fix an invalid Motoko method call syntax in the backend's `buildShuffledSectionFromArray` function.

**Planned changes:**
- In `backend/main.mo`, replace `e.primaryMuscleGroup.toLower()` and `group.toLower()` with `Text.toLowercase(e.primaryMuscleGroup)` and `Text.toLowercase(group)` inside the `buildShuffledSectionFromArray` filter expression only.

**User-visible outcome:** The backend compiles without errors, and muscle group filtering in `buildShuffledSectionFromArray` works correctly using the proper Motoko `Text.toLowercase()` API.
