import { WorkoutExercise } from '../types';

export interface WorkoutSection {
  name: string;
  exercises: Array<{ exercise: WorkoutExercise; index: number }>;
  subsections?: WorkoutSection[];
}

const REQUIRED_ORDER = ['Chest', 'Back', 'Arms', 'Legs', 'Core'];
const LEG_SUBGROUPS = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];

/**
 * Builds ordered workout sections from a flat exercise list.
 * Enforces the order: Chest → Back → Arms → Legs → Core
 * Legs section contains Quads/Hamstrings/Glutes/Calves as subsections.
 * Any unexpected groups are appended after Core in alphabetical order.
 */
export function buildOrderedSections(
  workout: WorkoutExercise[]
): WorkoutSection[] {
  // Group exercises by primary muscle group
  const grouped = workout.reduce((acc, ex, idx) => {
    const group = ex.exercise.primaryMuscleGroup;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push({ exercise: ex, index: idx });
    return acc;
  }, {} as Record<string, Array<{ exercise: WorkoutExercise; index: number }>>);

  const sections: WorkoutSection[] = [];
  const processedGroups = new Set<string>();

  // Process required groups in order
  for (const groupName of REQUIRED_ORDER) {
    if (groupName === 'Legs') {
      // Build Legs section with subsections
      const legSubsections: WorkoutSection[] = [];
      let hasAnyLegExercises = false;

      for (const subgroup of LEG_SUBGROUPS) {
        if (grouped[subgroup] && grouped[subgroup].length > 0) {
          hasAnyLegExercises = true;
          legSubsections.push({
            name: subgroup,
            exercises: grouped[subgroup],
          });
          processedGroups.add(subgroup);
        }
      }

      if (hasAnyLegExercises) {
        sections.push({
          name: 'Legs',
          exercises: [],
          subsections: legSubsections,
        });
      }
    } else {
      // Standard top-level group
      if (grouped[groupName] && grouped[groupName].length > 0) {
        sections.push({
          name: groupName,
          exercises: grouped[groupName],
        });
        processedGroups.add(groupName);
      }
    }
  }

  // Collect any unexpected groups
  const unexpectedGroups = Object.keys(grouped).filter(
    (g) => !processedGroups.has(g) && !LEG_SUBGROUPS.includes(g)
  );

  // Sort unexpected groups alphabetically and append
  unexpectedGroups.sort((a, b) => a.localeCompare(b));
  for (const groupName of unexpectedGroups) {
    sections.push({
      name: groupName,
      exercises: grouped[groupName],
    });
  }

  return sections;
}
