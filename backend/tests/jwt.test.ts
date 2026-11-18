import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken } from '../src/utils/jwt';

describe('JWT utils', () => {
  it('generate & verify token roundtrip', () => {
    const token = generateToken({ userId: 'u1', role: 'admin' });
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('u1');
    expect(decoded?.role).toBe('admin');
  });

  it('returns null for invalid token', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });

  it('returns null for token signed with different secret', () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ userId: 'u1', role: 'admin' }, 'wrong-secret');
    expect(verifyToken(bad)).toBeNull();
  });
});
