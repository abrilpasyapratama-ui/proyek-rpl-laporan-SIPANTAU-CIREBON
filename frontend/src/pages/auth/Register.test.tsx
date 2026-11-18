import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

import Register from './Register';

const postMock = vi.mocked(api.post);

const fillForm = (overrides: Partial<Record<string, string>> = {}) => {
  const data = {
    nama: 'Pengguna Contoh',
    email: 'pengguna.contoh@example.com',
    password: 'Passw0rd123',
    confirmPassword: 'Passw0rd123',
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: data.nama } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: data.email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: data.password } });
  fireEvent.change(screen.getByLabelText('Konfirmasi Password'), {
    target: { value: data.confirmPassword },
  });
  fireEvent.click(screen.getByRole('checkbox'));
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: /Daftar Sekarang/i }));

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders logo, system name, and description', () => {
    render(<Register />);
    expect(screen.getByRole('img', { name: /logo sistem pelaporan fasilitas/i })).toBeTruthy();
    expect(screen.getByText('SIPANTAU CIREBON')).toBeTruthy();
    expect(screen.getByText(/Sistem Pelaporan Fasilitas Umum Rusak Kota\/Kabupaten Cirebon dengan AI/i)).toBeTruthy();
  });

  it('shows validation errors when submitting empty form', async () => {
    render(<Register />);
    submit();
    expect(await screen.findByText('Nama lengkap wajib diisi')).toBeTruthy();
    expect(screen.getByText('Email wajib diisi')).toBeTruthy();
    expect(screen.getByText('Password wajib diisi')).toBeTruthy();
    expect(screen.getByText('Konfirmasi password wajib diisi')).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('validates nama min 3 chars', async () => {
    render(<Register />);
    fillForm({ nama: 'Al' });
    submit();
    expect(await screen.findByText('Nama minimal 3 karakter')).toBeTruthy();
  });

  it('validates email format', async () => {
    render(<Register />);
    fillForm({ email: 'bukan-email' });
    submit();
    expect(await screen.findByText('Format email tidak valid')).toBeTruthy();
  });

  it('validates password criteria', async () => {
    render(<Register />);
    fillForm({ password: 'lemah', confirmPassword: 'lemah' });
    submit();
    expect(await screen.findByText('Password minimal 8 karakter')).toBeTruthy();
  });

  it('validates password confirmation mismatch', async () => {
    render(<Register />);
    fillForm({ confirmPassword: 'Berbeda123' });
    submit();
    expect(await screen.findByText('Password tidak cocok')).toBeTruthy();
  });

  it('toggles password visibility', () => {
    render(<Register />);
    const pwd = screen.getByLabelText('Password') as HTMLInputElement;
    expect(pwd.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /tampilkan password/i }));
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: /sembunyikan password/i }));
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password');
  });

  it('shows password strength indicator while typing', () => {
    render(<Register />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Abcdefgh1' } });
    expect(screen.getByText(/Kekuatan:/i)).toBeTruthy();
    expect(screen.getByText('Huruf besar (A-Z)')).toBeTruthy();
  });

  it('submits successfully and shows loading + success state', async () => {
    let resolvePost: (v: { data: { status: string } }) => void;
    postMock.mockImplementationOnce(
      () => new Promise((res) => { resolvePost = res; })
    );
    render(<Register />);
    fillForm();
    submit();

    // Loading state: spinner + disabled
    const loadingBtn = await screen.findByRole('button', { name: /Memproses/i });
    expect(loadingBtn).toBeTruthy();
    expect((loadingBtn as HTMLButtonElement).disabled).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(1);

    // Resolve -> success state
    resolvePost!({ data: { status: 'success' } });
    expect(await screen.findByText(/Registrasi berhasil/i)).toBeTruthy();
  });

  it('prevents double submit', async () => {
    let resolvePost: (v: { data: { status?: string } }) => void;
    postMock.mockImplementationOnce(
      () => new Promise((res) => { resolvePost = res; })
    );
    render(<Register />);
    fillForm();
    const btn = screen.getByRole('button', { name: /Daftar Sekarang/i });
    fireEvent.click(btn);
    fireEvent.click(btn); // klik kedua pada elemen yang sama harus diabaikan
    expect(postMock).toHaveBeenCalledTimes(1);
    resolvePost!({ data: {} });
  });

  it('shows "Email sudah digunakan" on 409', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Email sudah terdaftar' } } });
    render(<Register />);
    fillForm();
    submit();
    expect(await screen.findByText('Email sudah digunakan')).toBeTruthy();
  });

  it('shows server error on 500', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    render(<Register />);
    fillForm();
    submit();
    expect(await screen.findByText(/Terjadi kesalahan pada server/i)).toBeTruthy();
  });

  it('shows connection error when server unreachable', async () => {
    postMock.mockRejectedValueOnce(new Error('Network Error'));
    render(<Register />);
    fillForm();
    submit();
    expect(await screen.findByText(/Tidak dapat terhubung ke server/i)).toBeTruthy();
  });

  it('has accessible labels and aria attributes', () => {
    render(<Register />);
    expect(screen.getByLabelText('Nama Lengkap')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText('Konfirmasi Password')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'salah' } });
    fireEvent.blur(screen.getByLabelText('Email'));
    waitFor(() => {
      const email = screen.getByLabelText('Email') as HTMLInputElement;
      expect(email.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('renders role cards with Masyarakat selected by default', () => {
    render(<Register />);
    expect(screen.getByText('Daftar sebagai')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Masyarakat/i }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByLabelText(/Instansi/)).toBeNull();
  });

  it('shows petugas fields when Petugas role is selected', () => {
    render(<Register />);
    fireEvent.click(screen.getByRole('radio', { name: /Petugas/i }));
    expect(screen.getByRole('radio', { name: /Petugas/i }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText(/Nomor HP/)).toBeTruthy();
    expect(screen.getByLabelText(/Instansi/)).toBeTruthy();
    expect(screen.getByLabelText(/Wilayah/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Kirim Pengajuan/i })).toBeTruthy();
  });

  it('requires consent before submitting', async () => {
    render(<Register />);
    fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: 'Nama Valid' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Passw0rd123' } });
    fireEvent.change(screen.getByLabelText('Konfirmasi Password'), { target: { value: 'Passw0rd123' } });
    submit();
    expect(await screen.findByText('Anda harus menyetujui kebijakan privasi')).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('submits petugas registration with role and shows pending message', async () => {
    postMock.mockResolvedValueOnce({
      data: { status: 'success', message: 'Registrasi berhasil dikirim. Akun Anda menunggu verifikasi Admin.' },
    });
    render(<Register />);
    fireEvent.click(screen.getByRole('radio', { name: /Petugas/i }));
    fillForm();
    fireEvent.change(screen.getByLabelText(/Nomor HP/), { target: { value: '081234567890' } });
    fireEvent.change(screen.getByLabelText(/Instansi/), { target: { value: 'Dinas PU' } });
    fireEvent.change(screen.getByLabelText(/Wilayah/), { target: { value: 'Kejaksan' } });
    fireEvent.click(screen.getByRole('button', { name: /Kirim Pengajuan/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({ role: 'petugas', instansi: 'Dinas PU', wilayah: 'Kejaksan' })
    );
    expect(await screen.findByText(/menunggu verifikasi Admin/i)).toBeTruthy();
  });
});
