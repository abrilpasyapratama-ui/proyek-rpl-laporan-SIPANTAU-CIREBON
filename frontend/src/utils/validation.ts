/**
 * Utilitas validasi form Register.
 * Fungsi murni agar dapat di-unit-test tanpa render React.
 */

export const MIN_NAMA = 3;
export const MIN_PASSWORD = 8;

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export const validateNama = (nama: string): string | null => {
  const value = nama.trim();
  if (!value) return 'Nama lengkap wajib diisi';
  if (value.length < MIN_NAMA) return `Nama minimal ${MIN_NAMA} karakter`;
  return null;
};

export const validateEmail = (email: string): string | null => {
  const value = email.trim();
  if (!value) return 'Email wajib diisi';
  if (!isValidEmail(value)) return 'Format email tidak valid';
  return null;
};

export interface PasswordErrors {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
}

export const getPasswordErrors = (password: string): PasswordErrors => ({
  minLength: password.length >= MIN_PASSWORD,
  hasUpper: /[A-Z]/.test(password),
  hasLower: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
});

export const validatePassword = (password: string): string | null => {
  if (!password) return 'Password wajib diisi';
  const errs = getPasswordErrors(password);
  if (!errs.minLength) return `Password minimal ${MIN_PASSWORD} karakter`;
  if (!errs.hasUpper) return 'Password harus mengandung huruf besar';
  if (!errs.hasLower) return 'Password harus mengandung huruf kecil';
  if (!errs.hasNumber) return 'Password harus mengandung angka';
  return null;
};

export const validateConfirmPassword = (
  password: string,
  confirm: string
): string | null => {
  if (!confirm) return 'Konfirmasi password wajib diisi';
  if (confirm !== password) return 'Password tidak cocok';
  return null;
};

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface StrengthResult {
  level: StrengthLevel;
  label: string;
  color: string; // kelas tailwind untuk bar
  textColor: string;
}

/** Indikator kekuatan password 0..4 */
export const getPasswordStrength = (password: string): StrengthResult => {
  if (!password) {
    return { level: 0, label: '', color: 'bg-slate-200', textColor: 'text-slate-400' };
  }
  const errs = getPasswordErrors(password);
  let score = 0;
  if (errs.minLength) score++;
  if (errs.hasUpper) score++;
  if (errs.hasLower) score++;
  if (errs.hasNumber) score++;
  if (password.length >= 12 && score === 4) score = 4;

  switch (score) {
    case 0:
    case 1:
      return { level: 1, label: 'Lemah', color: 'bg-red-500', textColor: 'text-red-600' };
    case 2:
      return { level: 2, label: 'Cukup', color: 'bg-amber-500', textColor: 'text-amber-600' };
    case 3:
      return { level: 3, label: 'Baik', color: 'bg-blue-500', textColor: 'text-blue-600' };
    default:
      return { level: 4, label: 'Kuat', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
  }
};
