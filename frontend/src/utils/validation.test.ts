import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  validateNama,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  getPasswordErrors,
  getPasswordStrength,
} from './validation';

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a.b@sub.domain.co.id')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('plainaddress')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@no-local.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('validateNama', () => {
  it('requires nama', () => {
    expect(validateNama('')).toBe('Nama lengkap wajib diisi');
  });

  it('requires min 3 chars', () => {
    expect(validateNama('Al')).toBe('Nama minimal 3 karakter');
    expect(validateNama('  Al  ')).toBe('Nama minimal 3 karakter');
  });

  it('accepts valid nama', () => {
    expect(validateNama('Abril Pasyapratama')).toBeNull();
    expect(validateNama('  Budi  ')).toBeNull();
  });
});

describe('validateEmail', () => {
  it('requires email', () => {
    expect(validateEmail('')).toBe('Email wajib diisi');
  });

  it('rejects invalid format', () => {
    expect(validateEmail('bukan-email')).toBe('Format email tidak valid');
  });

  it('accepts valid email', () => {
    expect(validateEmail('abril@gmail.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('requires password', () => {
    expect(validatePassword('')).toBe('Password wajib diisi');
  });

  it('requires min 8 chars', () => {
    expect(validatePassword('Abc1')).toBe('Password minimal 8 karakter');
  });

  it('requires uppercase', () => {
    expect(validatePassword('abcdefgh1')).toBe('Password harus mengandung huruf besar');
  });

  it('requires lowercase', () => {
    expect(validatePassword('ABCDEFGH1')).toBe('Password harus mengandung huruf kecil');
  });

  it('requires number', () => {
    expect(validatePassword('Abcdefgh')).toBe('Password harus mengandung angka');
  });

  it('accepts strong password', () => {
    expect(validatePassword('Passw0rd')).toBeNull();
    expect(validatePassword('Str0ngPass!')).toBeNull();
  });
});

describe('getPasswordErrors', () => {
  it('flags all criteria', () => {
    expect(getPasswordErrors('')).toEqual({
      minLength: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
    });
    expect(getPasswordErrors('Abcdefgh1')).toEqual({
      minLength: true,
      hasUpper: true,
      hasLower: true,
      hasNumber: true,
    });
  });
});

describe('validateConfirmPassword', () => {
  it('requires confirm', () => {
    expect(validateConfirmPassword('Passw0rd', '')).toBe('Konfirmasi password wajib diisi');
  });

  it('rejects mismatch', () => {
    expect(validateConfirmPassword('Passw0rd', 'Passw0rd!')).toBe('Password tidak cocok');
  });

  it('accepts match', () => {
    expect(validateConfirmPassword('Passw0rd', 'Passw0rd')).toBeNull();
  });
});

describe('getPasswordStrength', () => {
  it('returns empty for empty password', () => {
    expect(getPasswordStrength('').level).toBe(0);
    expect(getPasswordStrength('').label).toBe('');
  });

  it('weak for short/simple', () => {
    expect(getPasswordStrength('abc').level).toBeLessThanOrEqual(1);
  });

  it('strong for full criteria + length', () => {
    const r = getPasswordStrength('Str0ngPassw0rd!');
    expect(r.level).toBe(4);
    expect(r.label).toBe('Kuat');
  });
});
