import { toStackName } from '../lib/utils';

describe('toStackName', () => {
  test('should return a string with the correct format', () => {
    const name = 'CodebuildStack-x86_64_ubuntu';
    const expected = 'CodebuildStack-x86-64-ubuntu';
    const actual = toStackName(name);
    expect(actual).toBe(expected);
  });
});
