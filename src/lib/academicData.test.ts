import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAcademicSessionRolloverPlan,
  CAMPUS_OPTIONS,
  getLevelsForCampus,
  GRADUATE_LEVEL,
  handleCampusCascade,
  isGraduateLevel,
  promoteStudentLevel,
} from './academicData';

test('CAMPUS_OPTIONS exposes LASUED and LASU', () => {
  assert.deepEqual([...CAMPUS_OPTIONS], ['LASUED', 'LASU']);
});

test('getLevelsForCampus caps LASUED at 400L and LASU at 600L', () => {
  assert.deepEqual([...getLevelsForCampus('LASUED')], [
    '100L',
    '200L',
    '300L',
    '400L',
  ]);
  assert.deepEqual([...getLevelsForCampus('LASU')], [
    '100L',
    '200L',
    '300L',
    '400L',
    '500L',
    '600L',
  ]);
  assert.deepEqual([...getLevelsForCampus('')], []);
});

test('handleCampusCascade clears incompatible level when switching campus', () => {
  assert.deepEqual(handleCampusCascade('LASUED', '500L'), {
    campus: 'LASUED',
    level: '',
  });

  assert.deepEqual(handleCampusCascade('LASUED', '300L'), {
    campus: 'LASUED',
    level: '300L',
  });
});

test('isGraduateLevel and promoteStudentLevel enforce campus progression caps and permanent Graduate status', () => {
  assert.equal(GRADUATE_LEVEL, 'Graduate');
  assert.equal(isGraduateLevel('Graduate'), true);
  assert.equal(isGraduateLevel(' graduate '), true);
  assert.equal(isGraduateLevel('400L'), false);

  // LASUED progression caps at 400L -> Graduate
  assert.equal(promoteStudentLevel('LASUED', '100L'), '200L');
  assert.equal(promoteStudentLevel('LASUED', '300L'), '400L');
  assert.equal(promoteStudentLevel('LASUED', '400L'), 'Graduate');
  assert.equal(promoteStudentLevel('LASUED', 'Graduate'), null);

  // LASU progression caps at 600L -> Graduate
  assert.equal(promoteStudentLevel('LASU', '400L'), '500L');
  assert.equal(promoteStudentLevel('LASU', '500L'), '600L');
  assert.equal(promoteStudentLevel('LASU', '600L'), 'Graduate');
  assert.equal(promoteStudentLevel('LASU', 'Graduate'), null);

  // Missing or invalid levels are untouched
  assert.equal(promoteStudentLevel('LASUED', ''), null);
  assert.equal(promoteStudentLevel('LASU', '900L'), null);
});

test('buildAcademicSessionRolloverPlan advances students, graduates finalists, preserves Graduates, and skips marketers', () => {
  const plan = buildAcademicSessionRolloverPlan([
    {
      uid: 'stu-lasued-100',
      fullName: 'Ada Okafor',
      campus: 'LASUED',
      level: '100L',
      accountType: 'student',
    },
    {
      uid: 'stu-lasued-400',
      fullName: 'Bola Adeyemi',
      campus: 'LASUED',
      level: '400L',
      accountType: 'student',
    },
    {
      uid: 'stu-lasu-500',
      fullName: 'Chidi Eze',
      campus: 'LASU',
      level: '500L',
      accountType: 'student',
    },
    {
      uid: 'stu-lasu-600',
      fullName: 'Dami Salami',
      campus: 'LASU',
      level: '600L',
      accountType: 'student',
    },
    {
      uid: 'stu-grad',
      fullName: 'Femi Alabi',
      campus: 'LASUED',
      level: 'Graduate',
      accountType: 'student',
    },
    {
      uid: 'stu-incomplete',
      fullName: 'New Student',
      campus: 'LASUED',
      level: '',
      accountType: 'student',
    },
    {
      uid: 'mkt-explicit',
      fullName: 'Tunde Bello',
      accountType: 'business',
      businessName: 'Tunde Gadgets',
    },
    {
      uid: 'mkt-legacy',
      fullName: 'Seyi Ventures',
      accountType: 'student',
      roles: { buyer: true, landlord: true },
      campus: 'LASU',
      level: '300L',
    },
  ]);

  assert.equal(plan.advancingCount, 2);
  assert.equal(plan.graduatingCount, 2);
  assert.equal(plan.alreadyGraduateCount, 1);
  assert.equal(plan.incompleteStudentsSkipped, 1);
  assert.equal(plan.marketersSkipped, 2);

  assert.deepEqual(
    plan.updates.map((u) => ({ uid: u.uid, from: u.fromLevel, to: u.toLevel, grad: u.graduated })),
    [
      { uid: 'stu-lasued-100', from: '100L', to: '200L', grad: false },
      { uid: 'stu-lasued-400', from: '400L', to: 'Graduate', grad: true },
      { uid: 'stu-lasu-500', from: '500L', to: '600L', grad: false },
      { uid: 'stu-lasu-600', from: '600L', to: 'Graduate', grad: true },
    ]
  );
});
