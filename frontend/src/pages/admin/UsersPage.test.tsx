import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import UsersPage from './UsersPage';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const patchMock = vi.mocked(api.patch);
const deleteMock = vi.mocked(api.delete);

const ADMIN = {
  id: 'a1',
  nama: 'Abril Pasya Pratama',
  email: 'abril@example.com',
  username: 'april.pratama',
  no_hp: '085147722749',
  role: 'admin',
  status: 'AKTIF',
  created_at: '2026-01-01T00:00:00.000Z',
  _count: { reports: 0 },
};

const WARGA = {
  id: 'u1',
  nama: 'Warga Satu',
  email: 'warga@example.com',
  username: 'warga.satu',
  no_hp: '081234567890',
  role: 'masyarakat',
  status: 'AKTIF',
  created_at: '2026-05-01T00:00:00.000Z',
  _count: { reports: 2 },
};

const NONAKTIF = {
  id: 'u2',
  nama: 'Warga Nonaktif',
  email: 'nonaktif@example.com',
  username: null,
  no_hp: null,
  role: 'masyarakat',
  status: 'NONAKTIF',
  created_at: '2026-06-01T00:00:00.000Z',
  _count: { reports: 1 },
};

const loginAsAdmin = () =>
  useAuthStore.getState().login(
    {
      id: ADMIN.id,
      nama: ADMIN.nama,
      email: ADMIN.email,
      username: ADMIN.username,
      no_hp: ADMIN.no_hp,
      role: 'admin',
      status: 'AKTIF',
    },
    'token-admin'
  );

const renderPage = async () => {
  render(<UsersPage />);
  await screen.findByText('Warga Satu');
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.getState().logout();
  loginAsAdmin();

  getMock.mockResolvedValue({
    data: { status: 'success', data: [ADMIN, WARGA, NONAKTIF], meta: { total: 3 } },
  });
});

describe('UsersPage — Kelola Pengguna', () => {
  it('menampilkan kolom aksi Edit dan Hapus untuk setiap baris', async () => {
    await renderPage();

    expect(screen.getByLabelText('Edit Warga Satu')).toBeTruthy();
    expect(screen.getByLabelText('Hapus Warga Satu')).toBeTruthy();
    expect(screen.getByText('Warga Satu')).toBeTruthy();
    expect(screen.getByText('warga@example.com')).toBeTruthy();
  });

  it('menampilkan data lama secara otomatis di modal edit', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Edit Warga Satu'));

    expect(screen.getByText('Edit Pengguna')).toBeTruthy();
    expect((screen.getByLabelText('Nama Lengkap') as HTMLInputElement).value).toBe('Warga Satu');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('warga@example.com');
    expect((screen.getByLabelText('Nomor HP') as HTMLInputElement).value).toBe('081234567890');
    expect((screen.getByLabelText('Username (opsional)') as HTMLInputElement).value).toBe('warga.satu');
    expect((screen.getByLabelText('Role') as HTMLSelectElement).value).toBe('masyarakat');
    expect((screen.getByLabelText('Status Akun') as HTMLSelectElement).value).toBe('AKTIF');
  });

  it('menyimpan perubahan nama tanpa reload dan memperbarui baris tabel', async () => {
    patchMock.mockResolvedValue({
      data: {
        status: 'success',
        message: 'Data pengguna berhasil diperbarui',
        data: { ...WARGA, nama: 'Warga Baru' },
      },
    });

    await renderPage();
    fireEvent.click(screen.getByLabelText('Edit Warga Satu'));
    fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: 'Warga Baru' } });
    fireEvent.click(screen.getByText('Simpan Perubahan'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/admin/users/u1', { nama: 'Warga Baru' })
    );
    expect(await screen.findByText('Warga Baru')).toBeTruthy();
    expect(screen.getByText('Data pengguna berhasil diperbarui')).toBeTruthy();
  });

  it('menampilkan pesan kesalahan jika email duplikat', async () => {
    patchMock.mockRejectedValue(new Error('Email sudah digunakan akun lain'));

    await renderPage();
    fireEvent.click(screen.getByLabelText('Edit Warga Satu'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dipakai@example.com' } });
    fireEvent.click(screen.getByText('Simpan Perubahan'));

    expect(await screen.findByText('Email sudah digunakan akun lain')).toBeTruthy();
    // modal tetap terbuka agar admin dapat memperbaiki input
    expect(screen.getByText('Edit Pengguna')).toBeTruthy();
  });

  it('menampilkan konfirmasi hapus berisi nama dan email', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Hapus Warga Satu'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Hapus Akun?')).toBeTruthy();
    expect(within(dialog).getByText('Warga Satu')).toBeTruthy();
    expect(within(dialog).getByText('warga@example.com')).toBeTruthy();
    expect(within(dialog).getByText(/data historis tetap tersimpan/i)).toBeTruthy();
  });

  it('menghapus/menonaktifkan akun dan memperbarui status tanpa reload', async () => {
    deleteMock.mockResolvedValue({
      data: {
        status: 'success',
        mode: 'soft_delete',
        message: 'Akun dinonaktifkan karena memiliki riwayat data.',
        relations: { reports: 2 },
        data: { ...WARGA, status: 'NONAKTIF' },
      },
    });

    await renderPage();
    fireEvent.click(screen.getByLabelText('Hapus Warga Satu'));
    fireEvent.click(screen.getByText('Hapus / Nonaktifkan'));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('/admin/users/u1'));
    expect(await screen.findByText('Akun dinonaktifkan karena memiliki riwayat data.')).toBeTruthy();
  });

  it('tidak mengizinkan admin menghapus akunnya sendiri', async () => {
    await renderPage();
    const selfDelete = screen.getByLabelText('Hapus Abril Pasya Pratama') as HTMLButtonElement;
    expect(selfDelete.disabled).toBe(true);
  });

  it('role dan status akun sendiri tidak dapat diubah di modal edit', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Edit Abril Pasya Pratama'));

    expect((screen.getByLabelText('Role') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Status Akun') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/tidak dapat diubah dari halaman ini/i)).toBeTruthy();
  });

  it('meminta konfirmasi saat mengubah role menjadi admin', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    patchMock.mockResolvedValue({
      data: {
        status: 'success',
        message: 'Data pengguna berhasil diperbarui',
        data: { ...WARGA, role: 'admin' },
      },
    });

    await renderPage();
    fireEvent.click(screen.getByLabelText('Edit Warga Satu'));
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByText('Simpan Perubahan'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/admin/users/u1', { role: 'admin' })
    );
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/akun administrator/i));
    confirmSpy.mockRestore();
  });

  it('filter role mengirim parameter role ke backend', async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText('Filter role'), { target: { value: 'petugas' } });

    await waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith(
        '/admin/users',
        expect.objectContaining({ params: expect.objectContaining({ role: 'petugas' }) })
      )
    );
  });
});
