import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuthStore } from '../store/useAuthStore';

const renderWithRouter = (allowedRoles?: string[]) =>
  render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/secret" element={<div>SECRET CONTENT</div>} />
        </Route>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  beforeEach(() => useAuthStore.getState().logout());

  it('redirects to /login when not authenticated', () => {
    renderWithRouter(['admin']);
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
    expect(screen.queryByText('SECRET CONTENT')).toBeNull();
  });

  it('renders children when role allowed', () => {
    useAuthStore.getState().login({ id: '1', nama: 'A', email: 'a@b.com', role: 'admin' }, 't');
    renderWithRouter(['admin']);
    expect(screen.getByText('SECRET CONTENT')).toBeTruthy();
  });

  it('denies access when role not allowed', () => {
    useAuthStore.getState().login({ id: '1', nama: 'M', email: 'm@b.com', role: 'masyarakat' }, 't');
    renderWithRouter(['admin']);
    expect(screen.queryByText('SECRET CONTENT')).toBeNull();
  });

  it('logs out and redirects pending account to login', () => {
    useAuthStore.getState().login(
      { id: '9', nama: 'P', email: 'p@b.com', role: 'petugas', status: 'MENUNGGU_VERIFIKASI' },
      't'
    );
    renderWithRouter(['petugas']);
    expect(screen.queryByText('SECRET CONTENT')).toBeNull();
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
