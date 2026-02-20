# Specification

## Summary
**Goal:** Fix backend syntax errors causing empty leg exercise arrays and ensure full recovery in test mode.

**Planned changes:**
- Replace invalid `.toLower()` method with `Text.toLowercase()` function in `buildShuffledSectionFromArray` filter
- Replace invalid `.toLower()` method with `Text.toLowercase()` function in `buildShuffledSectionFromArrayWithLimit` filter
- Change `fullyRecoveredTime` calculation in `adjustRecoveryForTestMode` to use negative offset `0 - (100 * 3_600_000_000_000)` to force 100% recovery
- Verify all three fixes are present in deployed code

**User-visible outcome:** Leg exercises will populate correctly in workout builder, and all muscle groups will show 100% recovery status in test mode.
