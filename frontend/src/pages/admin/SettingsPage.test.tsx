import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const patchMock = vi.mocked(api.patch);

const ME = {
  id: 'a1',
  nama: 'Nama Lama',
  email: 'lama@example.com',
  no_hp: '081234567890',
  username: 'nama.lama',
  role: 'admin',
  status: 'AKTIF',
  must_change_password: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.getState().logout();
  useAuthStore.getState().login(
    { id: 'a1', nama: 'Nama Lama', email: 'lama@example.com', username: 'nama.lama', role: 'admin', must_change_password: false },
    'token-admin'
  );
  getMock.mockResolvedValue({ data: { status: 'success', data: ME } });
});

describe('SettingsPage — edit profil sendiri', () => {
  it('memuat data lama ke formulir', async () => {
    renderPage();

    await waitFor(() =>
      expect((screen.getByLabelText('Nama Lengkap') as HTMLInputElement).value).toBe('Nama Lama')
    );
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('lama@example.com');
    expect((screen.getByLabelText(/Nomor HP/) as HTMLInputElement).value).toBe('081234567890');
    expect((screen.getByLabelText(/Username/) as HTMLInputElement).value).toBe('nama.lama');
  });

  it('menyimpan profil dan memperbarui store (header & sidebar) tanpa logout', async () => {
    patchMock.mockResolvedValue({
      data: {
        status: 'success',
        message: 'Profil berhasil diperbarui',
        data: {
          ...ME,
          nama: 'Abril Pasya Pratama',
          email: 'abrilpasyapratama@gmail.com',
          no_hp: '085147722749',
          username: 'april.pratama',
        },
      },
    });

    renderPage();
    await waitFor(() => screen.getByDisplayValue('Nama Lama'));

    fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: 'Abril Pasya Pratama' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'abrilpasyapratama@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Nomor HP/), { target: { value: '085147722749' } });
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'april.pratama' } });
    fireEvent.click(screen.getByText('Simpan Profil'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/auth/profile', {
        nama: 'Abril Pasya Pratama',
        email: 'abrilpasyapratama@gmail.com',
        no_hp: '085147722749',
        username: 'april.pratama',
      })
    );

    expect(await screen.findByText('Profil berhasil diperbarui.')).toBeTruthy();
    const stored = useAuthStore.getState().user;
    expect(stored?.nama).toBe('Abril Pasya Pratama');
    expect(stored?.email).toBe('abrilpasyapratama@gmail.com');
    expect(stored?.no_hp).toBe('085147722749');
    // sesi tetap valid
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('token-admin');
  });

  it('menampilkan pesan jika email sudah digunakan', async () => {
    patchMock.mockRejectedValue(new Error('Email sudah digunakan akun lain'));

    renderPage();
    await waitFor(() => screen.getByDisplayValue('Nama Lama'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dipakai@example.com' } });
    fireEvent.click(screen.getByText('Simpan Profil'));

    expect(await screen.findByText('Email sudah digunakan akun lain')).toBeTruthy();
  });

  it('form ubah password tetap berfungsi dan menolak konfirmasi tidak cocok', async () => {
    renderPage();
    await waitFor(() => screen.getByDisplayValue('Nama Lama'));

    fireEvent.change(screen.getByLabelText('Password Saat Ini'), { target: { value: 'Lama1234' } });
    fireEvent.change(screen.getByLabelText('Password Baru'), { target: { value: 'Baru12345' } });
    fireEvent.change(screen.getByLabelText('Konfirmasi Password Baru'), { target: { value: 'Beda12345' } });
    fireEvent.click(screen.getByRole('button', { name: /Ubah Password/i }));

    expect(await screen.findByText('Konfirmasi password tidak cocok.')).toBeTruthy();
    expect(patchMock).not.toHaveBeenCalled();
  });
});
