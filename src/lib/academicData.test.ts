import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPUS_OPTIONS,
  getLevelsForCampus,
  handleCampusCascade,
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
