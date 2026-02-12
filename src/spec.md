# Specification

## Summary
**Goal:** Remove all test recovery mode functionality from the backend and delete related frontend “Test Mode” UI so workout generation always runs in normal mode.

**Planned changes:**
- Remove `TEST_RECOVERY_MODE` (and any equivalent toggle) and all associated test-recovery branching/shortcut logic from `backend/main.mo`.
- Remove any backend method used to expose test recovery mode status (e.g., `isTestRecoveryModeEnabled`) and update regenerated frontend/backend bindings so the removed API is no longer referenced.
- Delete the frontend test-mode query/hook (e.g., `useIsTestRecoveryModeEnabled` and the `['testRecoveryMode']` query) and remove the “Test Mode” badge/indicator from `frontend/src/components/Header.tsx`.

**User-visible outcome:** The app no longer shows any “Test Mode” indicator, and workout generation always uses the standard recovery-based selection logic.
