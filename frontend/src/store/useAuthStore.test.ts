import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('login sets user and token', () => {
    useAuthStore.getState().login(
      { id: '1', nama: 'Budi', email: 'b@b.com', role: 'admin' },
      'token123'
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.role).toBe('admin');
    expect(useAuthStore.getState().token).toBe('token123');
  });

  it('logout clears state', () => {
    useAuthStore.getState().login({ id: '1', nama: 'B', email: 'b@b.com', role: 'admin' }, 't');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
