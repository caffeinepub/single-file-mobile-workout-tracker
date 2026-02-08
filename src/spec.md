# Specification

## Summary
**Goal:** Fix workout preview rendering so muscle groups always appear in a consistent global order, and ensure Core is shown correctly for Lower Body (+ Core) previews.

**Planned changes:**
- Update `frontend/src/pages/WorkoutPreviewPage.tsx` to render top-level muscle-group sections in this order when they have exercises: Chest → Back → Arms → Legs → Core.
- Fix Lower Body preview so Quads/Hamstrings/Glutes/Calves render only as subsections under a single top-level “Legs” section (subsection order: Quads, Hamstrings, Glutes, Calves).
- Render a “Core” section after “Legs” when Core exercises exist, using the provided JSX structure and weight/unit display logic.
- Ensure any unexpected/extra muscle groups render only after Core in a deterministic order and do not break the preview.
- Build and deploy a new draft containing these frontend preview fixes and provide the new draft version number.

**User-visible outcome:** Workout previews (including Lower Body and Lower Body + Core) show muscle groups in a stable order, Legs are grouped correctly with ordered subgroups, and Core appears after Legs when applicable.
