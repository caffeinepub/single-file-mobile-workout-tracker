# Specification

## Summary
**Goal:** Fix recovery calculation logic to ensure leg exercises appear in Full Body workouts when test mode is enabled.

**Planned changes:**
- Change adjustRecoveryForTestMode to set lastTrained to a fixed distant past timestamp (epoch 0 or 365 days ago) instead of Time.now() - offset, ensuring all muscle groups always evaluate to 100% recovery
- Fix calculateRecoveryPercentage to use Time.now() - lastTrained instead of 0 - lastTrained for accurate elapsed time calculation
- Add debug logging in generateFullBodyWorkout to print the actual size of leg exercise sections (quads, hamstrings, glutes, calves) after building them

**User-visible outcome:** Full Body workouts will consistently include leg exercises (squats, lunges, calf raises, etc.) when TEST_RECOVERY_MODE is enabled, fixing the current issue where legs are skipped due to incorrect recovery calculations.
