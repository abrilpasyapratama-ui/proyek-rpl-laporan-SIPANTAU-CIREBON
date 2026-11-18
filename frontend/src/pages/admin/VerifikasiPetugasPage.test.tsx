import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../services/api';
import VerifikasiPetugasPage from './VerifikasiPetugasPage';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const patchMock = vi.mocked(api.patch);

const pending = [
  {
    id: 'p9',
    nama: 'Petugas Baru',
    email: 'p9@x.id',
    no_hp: '0812',
    nip: null,
    instansi: 'Dinas PU',
    wilayah: 'Kejaksan',
    created_at: '2026-10-16T00:00:00.000Z',
  },
];

describe('VerifikasiPetugasPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders pending list with approve/reject actions', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'success', data: pending, meta: { total: 1 } } });
    render(
      <MemoryRouter>
        <VerifikasiPetugasPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Petugas Baru')).toBeTruthy();
    expect(screen.getByText('Dinas PU')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Setujui/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tolak/i })).toBeTruthy();
  });

  it('approves and removes item with notice', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'success', data: pending, meta: { total: 1 } } });
    patchMock.mockResolvedValueOnce({ data: { status: 'success', message: 'Akun petugas disetujui' } });
    render(
      <MemoryRouter>
        <VerifikasiPetugasPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Setujui/i }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/admin/verifications/p9', { action: 'APPROVE' }));
    expect(await screen.findByText('Akun petugas disetujui')).toBeTruthy();
    expect(screen.queryByText('Petugas Baru')).toBeNull();
  });

  it('shows empty state when none pending', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'success', data: [], meta: { total: 0 } } });
    render(
      <MemoryRouter>
        <VerifikasiPetugasPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Tidak ada pengajuan/i)).toBeTruthy();
  });
});
