import { UserRoles } from '../types';

export const CAMPUS_OPTIONS = ['LASUED', 'LASU'] as const;
export type CampusOption = (typeof CAMPUS_OPTIONS)[number];
export const GRADUATE_LEVEL = 'Graduate' as const;

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

export function isGraduateLevel(level?: string | null): boolean {
  return (level || '').trim().toLowerCase() === GRADUATE_LEVEL.toLowerCase();
}

/**
 * Advances a student's academic level by +1 session based on campus rules:
 * - LASUED: 100L -> 200L -> 300L -> 400L -> Graduate (stays Graduate forever)
 * - LASU:   100L -> 200L -> 300L -> 400L -> 500L -> 600L -> Graduate (stays Graduate forever)
 * Returns null if the level is unset, already Graduate, or unrecognized.
 */
export function promoteStudentLevel(
  campus?: string | null,
  currentLevel?: string | null
): string | null {
  const cleanLevel = (currentLevel || '').trim();
  if (!cleanLevel || isGraduateLevel(cleanLevel)) {
    return null;
  }

  const normalizedCampus = (campus || '').trim().toUpperCase();
  const levelMatch = /^(100|200|300|400|500|600)\s*L$/i.exec(cleanLevel);
  if (!levelMatch) {
    return null;
  }

  const numericLevel = Number(levelMatch[1]);
  const maxUndergradLevel = normalizedCampus === 'LASUED' ? 400 : 600;

  if (numericLevel >= maxUndergradLevel) {
    return GRADUATE_LEVEL;
  }

  return `${numericLevel + 100}L`;
}

export interface SessionRolloverUserCandidate {
  uid?: string;
  fullName?: string;
  email?: string;
  campus?: string;
  level?: string;
  accountType?: string;
  roles?: UserRoles;
  businessName?: string;
  shopAddress?: string;
  isOnlineOnly?: boolean;
}

export interface StudentLevelPromotionUpdate {
  uid: string;
  fullName: string;
  campus: string;
  fromLevel: string;
  toLevel: string;
  graduated: boolean;
}

export interface AcademicSessionRolloverPlan {
  updates: StudentLevelPromotionUpdate[];
  advancingCount: number;
  graduatingCount: number;
  alreadyGraduateCount: number;
  marketersSkipped: number;
  incompleteStudentsSkipped: number;
}

function isMarketerCandidate(user: SessionRolloverUserCandidate): boolean {
  const rawType =
    typeof user.accountType === 'string'
      ? user.accountType.trim().toLowerCase()
      : '';
  if (rawType === 'business' || rawType === 'marketer') {
    return true;
  }
  return Boolean(
    user.roles?.landlord === true ||
      (user.businessName && user.businessName.trim()) ||
      (user.shopAddress && user.shopAddress.trim()) ||
      typeof user.isOnlineOnly === 'boolean'
  );
}

/**
 * Computes the dry-run or execution plan for an Admin "+1 Session" yearly promotion.
 * Only affects Student profiles; Marketers, existing Graduates, and students without a level are untouched.
 */
export function buildAcademicSessionRolloverPlan(
  users: ReadonlyArray<SessionRolloverUserCandidate>
): AcademicSessionRolloverPlan {
  const updates: StudentLevelPromotionUpdate[] = [];
  let advancingCount = 0;
  let graduatingCount = 0;
  let alreadyGraduateCount = 0;
  let marketersSkipped = 0;
  let incompleteStudentsSkipped = 0;

  for (const user of users) {
    if (isMarketerCandidate(user)) {
      marketersSkipped += 1;
      continue;
    }

    const uid = (user.uid || '').trim();
    const level = (user.level || '').trim();
    if (!uid || !level) {
      incompleteStudentsSkipped += 1;
      continue;
    }

    if (isGraduateLevel(level)) {
      alreadyGraduateCount += 1;
      continue;
    }

    const nextLevel = promoteStudentLevel(user.campus, level);
    if (!nextLevel) {
      incompleteStudentsSkipped += 1;
      continue;
    }

    const graduated = isGraduateLevel(nextLevel);
    if (graduated) {
      graduatingCount += 1;
    } else {
      advancingCount += 1;
    }

    updates.push({
      uid,
      fullName: (user.fullName || user.email || uid).trim(),
      campus: (user.campus || '').trim() || 'LASU',
      fromLevel: level,
      toLevel: nextLevel,
      graduated,
    });
  }

  return {
    updates,
    advancingCount,
    graduatingCount,
    alreadyGraduateCount,
    marketersSkipped,
    incompleteStudentsSkipped,
  };
}

