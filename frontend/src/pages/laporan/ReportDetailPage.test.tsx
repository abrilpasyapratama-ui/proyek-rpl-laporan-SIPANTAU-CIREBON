import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from '../../services/api';
import ReportDetailPage from './ReportDetailPage';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const getMock = vi.mocked(api.get);

const mockReport = {
  id: 'r1',
  judul: 'Lampu jalan mati',
  deskripsi: 'Lampu tidak menyala',
  kategori: 'Penerangan Jalan',
  lokasi: 'Jl. Siliwangi',
  latitude: -6.7,
  longitude: 108.5,
  foto: null,
  status: 'DIPROSES',
  ai_kategori: null,
  ai_confidence: null,
  ai_priority: 'Sedang',
  created_at: '2026-10-01T00:00:00.000Z',
  assignments: [{ assigned_at: '2026-10-02T00:00:00.000Z', petugas: { nama: 'Petugas A' } }],
  updates: [],
};

describe('ReportDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders report detail with progress steps', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'success', data: mockReport } });
    render(
      <MemoryRouter initialEntries={['/reports/r1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Lampu jalan mati')).toBeTruthy();
    expect(screen.getByText('Petugas A', { exact: false })).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith('/reports/r1');
  });

  it('shows error state when fetch fails', async () => {
    getMock.mockRejectedValueOnce({ response: { status: 404, data: { message: 'not found' } } });
    render(
      <MemoryRouter initialEntries={['/reports/unknown']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Gagal memuat detail laporan/i)).toBeTruthy();
  });
});
