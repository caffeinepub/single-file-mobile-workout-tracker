# Specification

## Summary
**Goal:** Fix two Motoko filter syntax errors, fix the recovery test mode logic, and add a new `unifiedLegsLibrary` array with a disabled toggle to the backend.

**Planned changes:**
- In `buildShuffledSectionFromArray`, replace `.toLower()` method calls with `Text.toLowercase()` for muscle group comparison
- In `buildShuffledSectionFromArrayWithLimit`, replace `.toLower()` method calls with `Text.toLowercase()` for muscle group comparison
- In `adjustRecoveryForTestMode`, change `fullyRecoveredTime = 0` to `fullyRecoveredTime = 0 - (100 * 3_600_000_000_000)` so test mode forces 100% recovery
- Add `unifiedLegsLibrary` array with 17 leg exercises (all with `primaryMuscleGroup = "Legs"` and `recoveryTime = 72`) positioned after the existing `exerciseLibrary`
- Add `let useUnifiedLegs = false;` toggle immediately after `unifiedLegsLibrary` (not wired into any existing functions)

**User-visible outcome:** The backend compiles without filter syntax errors, test recovery mode correctly forces full recovery for all muscle groups, and a new legs exercise library is staged for future use.
