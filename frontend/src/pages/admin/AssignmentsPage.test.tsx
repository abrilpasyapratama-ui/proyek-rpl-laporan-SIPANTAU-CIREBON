import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../services/api';
import AssignmentsPage from './AssignmentsPage';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const getMock = vi.mocked(api.get);

const mockItems = [
  {
    id: 'a1',
    assigned_at: '2026-10-02T00:00:00.000Z',
    petugas: { id: 'p1', nama: 'Petugas A', email: 'p@x.id' },
    report: {
      id: 'r1',
      judul: 'Jalan berlubang',
      kategori: 'Jalan & Jembatan',
      status: 'DIPROSES',
      lokasi: 'Jl. Karanggetas',
      ai_priority: 'Tinggi',
      created_at: '2026-10-01T00:00:00.000Z',
    },
  },
];

describe('AssignmentsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders assignment rows', async () => {
    getMock.mockResolvedValueOnce({
      data: { status: 'success', data: mockItems, meta: { total: 1, page: 1, totalPages: 1 } },
    });
    render(
      <MemoryRouter>
        <AssignmentsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Jalan berlubang')).toBeTruthy();
    expect(screen.getByText('Petugas A')).toBeTruthy();
  });

  it('shows empty state when no assignments', async () => {
    getMock.mockResolvedValueOnce({
      data: { status: 'success', data: [], meta: { total: 0, page: 1, totalPages: 1 } },
    });
    render(
      <MemoryRouter>
        <AssignmentsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Belum ada penugasan/i)).toBeTruthy();
  });

  it('passes status filter to API', async () => {
    getMock.mockResolvedValue({
      data: { status: 'success', data: [], meta: { total: 0, page: 1, totalPages: 1 } },
    });
    render(
      <MemoryRouter>
        <AssignmentsPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('Filter status laporan'), { target: { value: 'SELESAI' } });
    await screen.findByText(/Belum ada penugasan/i);
    const lastCall = getMock.mock.calls[getMock.mock.calls.length - 1];
    expect(lastCall[0]).toBe('/admin/assignments');
    expect(lastCall[1]).toMatchObject({ params: expect.objectContaining({ status: 'SELESAI' }) });
  });
});
