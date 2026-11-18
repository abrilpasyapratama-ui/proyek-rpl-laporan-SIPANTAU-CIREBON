import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatbotWidget from './ChatbotWidget';
import { sendChatMessage } from '../../services/chatService';
import { useAuthStore } from '../../store/useAuthStore';

vi.mock('../../services/chatService', () => ({
  sendChatMessage: vi.fn(),
  listConversations: vi.fn().mockResolvedValue([]),
  getConversation: vi.fn(),
  deleteConversation: vi.fn(),
}));

const sendMock = vi.mocked(sendChatMessage);

const renderWidget = () => render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);

const setRole = (role: string) =>
  useAuthStore.getState().login({ id: 'u1', nama: 'Test', email: 't@t.id', role }, 'token');

describe('ChatbotWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('renders floating button and opens panel with greeting', () => {
    renderWidget();
    const btn = screen.getByLabelText('Buka chatbot Asisten SIPANTAU');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText(/Saya Asisten SIPANTAU/i)).toBeTruthy();
  });

  it('sends message and displays AI reply', async () => {
    sendMock.mockResolvedValueOnce({ reply: 'Total 3 laporan.', conversation_id: 'c1', tools_used: ['getDashboardStatistics'] });
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.change(screen.getByLabelText('Tulis pertanyaan untuk chatbot'), {
      target: { value: 'Berapa laporanku?' },
    });
    fireEvent.click(screen.getByLabelText('Kirim pesan'));
    expect(await screen.findByText('Total 3 laporan.')).toBeTruthy();
    expect(localStorage.getItem('sipantau-chat-id')).toBe('c1');
  });

  it('shows error state when send fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('Network Error'));
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.change(screen.getByLabelText('Tulis pertanyaan untuk chatbot'), { target: { value: 'Halo' } });
    fireEvent.click(screen.getByLabelText('Kirim pesan'));
    await waitFor(() => {
      expect(screen.getByText(/Network Error/i)).toBeTruthy();
    });
  });

  it('menampilkan contoh pertanyaan sesuai role admin', () => {
    setRole('admin');
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    expect(screen.getByText('Berapa total laporan saat ini?')).toBeTruthy();
    expect(screen.getByText(/paling sering dilaporkan/i)).toBeTruthy();
  });

  it('menampilkan contoh pertanyaan identitas untuk role admin', () => {
    setRole('admin');
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    expect(screen.getByText('Siapa saya?')).toBeTruthy();
    expect(screen.getByText('Apa email akun saya?')).toBeTruthy();
    expect(screen.getByText('Apa role dan jabatan saya?')).toBeTruthy();
    // tidak boleh ada data pribadi admin yang di-hardcode di frontend
    expect(document.body.textContent).not.toContain('abrilpasyapratama@gmail.com');
    expect(document.body.textContent).not.toContain('085147722749');
  });

  it('klik pertanyaan contoh identitas mengirim pertanyaan tersebut', async () => {
    setRole('admin');
    sendMock.mockResolvedValueOnce({
      reply: 'Anda adalah Abril Pasya Pratama, administrator SIPANTAU CIREBON.',
      conversation_id: 'c6',
      tools_used: ['getMyProfile'],
    });
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.click(screen.getByText('Siapa saya?'));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('Siapa saya?', undefined));
    expect(await screen.findByText(/administrator SIPANTAU CIREBON/)).toBeTruthy();
  });

  it('klik pertanyaan contoh mengirim pesan', async () => {
    setRole('masyarakat');
    sendMock.mockResolvedValueOnce({ reply: 'Anda punya 2 laporan.', conversation_id: 'c2', tools_used: ['getUserReports'] });
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.click(screen.getByText('Berapa total laporan saya?'));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('Berapa total laporan saya?', undefined));
    expect(await screen.findByText('Anda punya 2 laporan.')).toBeTruthy();
  });

  it('menampilkan tombol coba lagi saat gagal lalu mengirim ulang', async () => {
    setRole('masyarakat');
    sendMock.mockRejectedValueOnce(new Error('Gagal sementara'));
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.change(screen.getByLabelText('Tulis pertanyaan untuk chatbot'), { target: { value: 'Cek status' } });
    fireEvent.click(screen.getByLabelText('Kirim pesan'));

    const retry = await screen.findByText('Coba lagi');
    expect(retry).toBeTruthy();

    sendMock.mockResolvedValueOnce({ reply: 'Sudah diproses.', conversation_id: 'c3', tools_used: [] });
    fireEvent.click(retry);
    expect(await screen.findByText('Sudah diproses.')).toBeTruthy();
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('menyediakan tautan Peta GIS untuk hasil data lokasi', async () => {
    setRole('admin');
    sendMock.mockResolvedValueOnce({ reply: 'Ada 2 laporan di Kejaksan.', conversation_id: 'c4', tools_used: ['getReportsByLocation'] });
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.change(screen.getByLabelText('Tulis pertanyaan untuk chatbot'), { target: { value: 'Laporan di Kejaksan' } });
    fireEvent.click(screen.getByLabelText('Kirim pesan'));
    const link = await screen.findByText('Buka Peta GIS');
    expect(link.closest('a')?.getAttribute('href')).toBe('/admin/map');
  });

  it('menyediakan tautan statistik untuk hasil analitik (admin)', async () => {
    setRole('admin');
    sendMock.mockResolvedValueOnce({ reply: 'Wilayah terbanyak: Kejaksan.', conversation_id: 'c5', tools_used: ['getReportAnalytics'] });
    renderWidget();
    fireEvent.click(screen.getByLabelText('Buka chatbot Asisten SIPANTAU'));
    fireEvent.change(screen.getByLabelText('Tulis pertanyaan untuk chatbot'), { target: { value: 'Wilayah terbanyak?' } });
    fireEvent.click(screen.getByLabelText('Kirim pesan'));
    const link = await screen.findByText('Lihat statistik');
    expect(link.closest('a')?.getAttribute('href')).toBe('/admin/statistics');
  });
});
