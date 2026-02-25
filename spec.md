# Specification

## Summary
**Goal:** Add a new `unifiedLegsLibrary` array and a `useUnifiedLegs` toggle to the backend without touching any existing code.

**Planned changes:**
- Add a new `unifiedLegsLibrary : [Exercise]` array in `backend/main.mo` positioned after the existing `exerciseLibrary` array, containing exactly 17 leg exercises (all with `primaryMuscleGroup = "Legs"` and `recoveryTime = 72`), each with the corresponding `demoUrl` from muscleandstrength.com
- Add a boolean toggle variable `let useUnifiedLegs = false;` in `backend/main.mo` after the `unifiedLegsLibrary` array declaration, not referenced by any existing functions

**User-visible outcome:** No visible frontend changes. The backend gains a new exercise library array and a migration toggle variable for future use, while all existing functionality remains unchanged.
