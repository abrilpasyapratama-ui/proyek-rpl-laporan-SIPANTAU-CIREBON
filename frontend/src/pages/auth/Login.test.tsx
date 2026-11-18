import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() },
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: null }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import Login from './Login';

const postMock = vi.mocked(api.post);

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('does not render any role picker', () => {
    render(<Login />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText(/Pilih peran Anda/i)).toBeNull();
    expect(screen.queryByText(/Masyarakat|Admin|Petugas/)).toBeNull();
  });

  it('redirects by backend role after login', async () => {
    postMock.mockResolvedValueOnce({
      data: { status: 'success', data: { token: 't', user: { id: 'u1', nama: 'A', email: 'a@b.c', role: 'masyarakat' } } },
    });
    render(<Login />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Rahasia123' } });
    fireEvent.click(screen.getByRole('button', { name: /Masuk/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    // Payload hanya email+password — tidak ada pemilihan role di UI
    expect(postMock).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'Rahasia123' });
    // Redirect mengikuti role dari backend (masyarakat)
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('shows validation error when fields empty', () => {
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /Masuk/i }));
    expect(screen.getByText(/Email dan password wajib diisi/i)).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('links to register and home', () => {
    render(<Login />);
    expect(screen.getByText(/Daftar di sini/i).closest('a')?.getAttribute('href')).toBe('/register');
    expect(screen.getByText(/Kembali ke Beranda/i).closest('a')?.getAttribute('href')).toBe('/');
  });

  it('shows pending-verification message on 403', async () => {
    postMock.mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Akun Anda menunggu verifikasi Admin. Silakan coba lagi setelah disetujui.' } },
    });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'p@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Rahasia123' } });
    fireEvent.click(screen.getByRole('button', { name: /Masuk/i }));
    expect(await screen.findByText(/menunggu verifikasi Admin/i)).toBeTruthy();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('redirects to settings when must_change_password is true', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: { token: 't', user: { id: 'a1', nama: 'A', email: 'a@b.c', role: 'admin', must_change_password: true } },
      },
    });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Rahasia123' } });
    fireEvent.click(screen.getByRole('button', { name: /Masuk/i }));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/admin/settings', {
        replace: true,
        state: { forcePasswordChange: true },
      })
    );
  });
});
