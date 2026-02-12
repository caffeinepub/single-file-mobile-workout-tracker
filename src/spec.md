# Specification

## Summary
**Goal:** Fix invalid Motoko filter syntax in `buildShuffledSectionFromArray` and ship a new draft build (v350+).

**Planned changes:**
- In `backend/main.mo`, replace the `buildShuffledSectionFromArray` filter logic that uses invalid `e.primaryMuscleGroup.toLower()` with the exact provided `Text.toLowercase` + `Text.equal` filter block.
- Keep all existing `Debug.print` statements and all other logic in `buildShuffledSectionFromArray` unchanged.
- Build and deploy a new draft with version number >= 350.

**User-visible outcome:** The deployed draft (v350+) compiles and can generate a Full Body workout end-to-end from the UI with non-empty exercise selections across expected muscle groups (assuming exercises exist for those groups).
