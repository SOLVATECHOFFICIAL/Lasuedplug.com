export const CAMPUS_OPTIONS = ['LASUED', 'LASU'] as const;
export type CampusOption = (typeof CAMPUS_OPTIONS)[number];

export const LEVELS_BY_CAMPUS: Record<CampusOption, readonly string[]> = {
  LASUED: ['100L', '200L', '300L', '400L'],
  LASU: ['100L', '200L', '300L', '400L', '500L', '600L'],
};

export function isValidCampus(campus: string): campus is CampusOption {
  return (CAMPUS_OPTIONS as readonly string[]).includes(campus);
}

export function getLevelsForCampus(campus: string): readonly string[] {
  if (!isValidCampus(campus)) {
    return [];
  }
  return LEVELS_BY_CAMPUS[campus];
}

export function handleCampusCascade(
  nextCampus: string,
  currentLevel: string
): { campus: string; level: string } {
  if (!isValidCampus(nextCampus)) {
    return { campus: '', level: '' };
  }

  const validLevels = LEVELS_BY_CAMPUS[nextCampus];

  return {
    campus: nextCampus,
    level: validLevels.includes(currentLevel) ? currentLevel : '',
  };
}
