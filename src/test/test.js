/* eslint-env jest */

const { calculateLeagueDate, calculateStartTimeFromLeagueDate, dateToSqlTimestamp } = require('../util');

describe('Utility functions', () => {
  test('calculateLeagueDate', () => {
    expect(calculateLeagueDate(1550577600000)).toBe('19021912');
    expect(calculateLeagueDate(1550584799999)).toBe('19021912');
    expect(calculateLeagueDate(1550584800000)).toBe('19021914');
  });

  test('calculateStartTimeFromLeagueDate should be inverse function of calculateLeagueDate', () => {
    const startTime = 1550577600000;
    expect(calculateStartTimeFromLeagueDate(calculateLeagueDate(startTime))).toBe(startTime);
  });

  test('dateToSqlTimestamp', () => {
    expect(dateToSqlTimestamp(1550577600000)).toBe('2019-02-19 12:00:00');
  });
});
