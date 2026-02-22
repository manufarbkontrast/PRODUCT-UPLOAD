import { describe, it, expect } from 'vitest';
import { escapeDriveQuery } from '@/lib/google/drive-utils';

describe('escapeDriveQuery', () => {
  it('escapes single quotes', () => {
    expect(escapeDriveQuery("O'Reilly")).toBe("O\\'Reilly");
  });

  it('escapes backslashes', () => {
    expect(escapeDriveQuery('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('handles strings with no special characters', () => {
    expect(escapeDriveQuery('simple-filename')).toBe('simple-filename');
  });

  it('handles combined escaping of backslashes and quotes', () => {
    expect(escapeDriveQuery("path\\to\\O'Reilly")).toBe("path\\\\to\\\\O\\'Reilly");
  });

  it('escapes multiple single quotes', () => {
    expect(escapeDriveQuery("It's a nice day's work")).toBe("It\\'s a nice day\\'s work");
  });

  it('handles empty string', () => {
    expect(escapeDriveQuery('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(escapeDriveQuery("\\'\\")).toBe("\\\\\\'\\\\");
  });
});
