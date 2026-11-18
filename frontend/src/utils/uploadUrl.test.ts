import { describe, it, expect } from 'vitest';
import { resolveUploadUrl, API_ORIGIN } from './uploadUrl';

describe('uploadUrl', () => {
  it('returns null for empty input', () => {
    expect(resolveUploadUrl(null)).toBeNull();
    expect(resolveUploadUrl(undefined)).toBeNull();
    expect(resolveUploadUrl('')).toBeNull();
  });

  it('prefixes relative upload paths with API origin', () => {
    expect(resolveUploadUrl('/uploads/foto.jpg')).toBe(`${API_ORIGIN}/uploads/foto.jpg`);
  });

  it('keeps absolute URLs untouched', () => {
    expect(resolveUploadUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
  });
});
