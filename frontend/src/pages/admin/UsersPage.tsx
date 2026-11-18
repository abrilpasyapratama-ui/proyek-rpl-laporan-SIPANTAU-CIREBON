import React, { useEffect, useState } from 'react';
import {
  Search,
  Users,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { extractErrorMessage } from '../../utils/apiError';

interface UserItem {
  id: string;
  nama: string;
  email: string;
  username: string | null;
  no_hp: string | null;
  role: string;
  status: string;
  created_at: string;
  _count?: { reports: number };
}

interface UserForm {
  nama: string;
  email: string;
  no_hp: string;
  username: string;
  role: string;
  status: string;
}

const ROLES = ['masyarakat', 'petugas', 'admin'] as const;
const ROLE_LABEL: Record<string, string> = {
  masyarakat: 'Masyarakat',
  petugas: 'Petugas',
  admin: 'Admin',
};
const STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  DITOLAK: 'Ditolak',
};

const roleBadge = (role: string) => {
  switch (role) {
    case 'admin':
      return 'bg-violet-50 text-violet-700 ring-violet-100';
    case 'petugas':
      return 'bg-sky-50 text-sky-700 ring-sky-100';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'AKTIF':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'NONAKTIF':
      return 'bg-red-50 text-red-700 ring-red-100';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
};

const inputCls =
  'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';

const UsersPage: React.FC = () => {
  const currentUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>({
    nama: '',
    email: '',
    no_hp: '',
    username: '',
    role: 'masyarakat',
    status: 'AKTIF',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [deleting, setDeleting] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = async (opts: { q?: string; role?: string; status?: string } = {}) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users', {
        params: {
          q: opts.q ?? search,
          role: (opts.role ?? roleFilter) || undefined,
          status: (opts.status ?? statusFilter) || undefined,
          limit: 100,
        },
      });
      setUsers(res.data.data || []);
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memuat daftar pengguna');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load({ q: search });
  };

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    load({ role: value });
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    load({ status: value });
  };

  const openEdit = (u: UserItem) => {
    setEditing(u);
    setForm({
      nama: u.nama,
      email: u.email,
      no_hp: u.no_hp || '',
      username: u.username || '',
      role: u.role,
      status: u.status,
    });
    setModalError('');
  };

  const closeEdit = () => {
    if (isSaving) return;
    setEditing(null);
    setModalError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    setModalError('');
    if (form.nama.trim().length < 3) {
      setModalError('Nama minimal 3 karakter.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setModalError('Format email tidak valid.');
      return;
    }
    const phoneDigits = form.no_hp.replace(/\D/g, '');
    if (form.no_hp.trim() && !/^(0|62)?8\d{7,12}$/.test(phoneDigits)) {
      setModalError('Format nomor HP tidak valid. Contoh: 081234567890.');
      return;
    }
    if (form.username.trim() && !/^[a-zA-Z0-9._-]{3,50}$/.test(form.username.trim())) {
      setModalError('Username 3–50 karakter, hanya huruf, angka, titik, garis bawah, atau tanda hubung.');
      return;
    }

    const isSelf = editing.id === currentUser?.id;
    const roleChanged = form.role !== editing.role;
    const statusChanged = form.status !== editing.status;

    // Konfirmasi khusus saat menyentuh akun administrator.
    if (roleChanged || statusChanged) {
      const touchesAdmin =
        editing.role === 'admin' || form.role === 'admin' || (editing.role === 'admin' && statusChanged);
      if (touchesAdmin) {
        const detail = roleChanged
          ? `Role akan diubah dari ${ROLE_LABEL[editing.role]} menjadi ${ROLE_LABEL[form.role]}.`
          : `Status akun akan diubah menjadi ${STATUS_LABEL[form.status]}.`;
        if (!window.confirm(`Perubahan pada akun administrator ${editing.nama}. ${detail} Lanjutkan?`)) {
          return;
        }
      }
    }

    if (isSelf && (roleChanged || statusChanged)) {
      setModalError('Role dan status akun sendiri tidak dapat diubah dari halaman ini.');
      return;
    }

    const payload: Record<string, string | null> = {};
    if (form.nama.trim() !== editing.nama) payload.nama = form.nama.trim();
    if (form.email.trim().toLowerCase() !== editing.email.toLowerCase()) payload.email = form.email.trim();
    if ((form.no_hp.trim() || '') !== (editing.no_hp || '')) payload.no_hp = form.no_hp.trim() || null;
    if ((form.username.trim() || '') !== (editing.username || '')) payload.username = form.username.trim() || null;
    if (roleChanged) payload.role = form.role;
    if (statusChanged) payload.status = form.status;

    if (Object.keys(payload).length === 0) {
      setModalError('Tidak ada perubahan untuk disimpan.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.patch(`/admin/users/${editing.id}`, payload);
      const updated = res.data.data as UserItem;

      setUsers((prev) =>
        prev.map((u) => (u.id === editing.id ? { ...u, ...updated } : u))
      );

      // Jika admin mengedit dirinya sendiri, sinkronkan header & sidebar.
      if (isSelf && currentUser && token) {
        login(
          {
            ...currentUser,
            nama: updated.nama,
            email: updated.email,
            username: updated.username,
            no_hp: updated.no_hp,
            role: updated.role,
            status: updated.status,
          },
          token
        );
      }

      setNotice(res.data.message || 'Data pengguna berhasil diperbarui.');
      setEditing(null);
    } catch (err) {
      setModalError(extractErrorMessage(err) || 'Gagal memperbarui data pengguna.');
    } finally {
      setIsSaving(false);
    }
  };

  const openDelete = (u: UserItem) => {
    setDeleting(u);
    setDeleteError('');
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setDeleting(null);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await api.delete(`/admin/users/${deleting.id}`);
      if (res.data.mode === 'hard_delete') {
        setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === deleting.id ? { ...u, status: 'NONAKTIF' } : u))
        );
      }
      setNotice(res.data.message || 'Akun berhasil diproses.');
      setDeleting(null);
    } catch (err) {
      setDeleteError(extractErrorMessage(err) || 'Gagal menghapus pengguna.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isSelf = (id: string) => id === currentUser?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Kelola Pengguna</h2>
          <p className="text-sm text-slate-500">Kelola data, role, dan status seluruh akun</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={roleFilter}
            onChange={(e) => handleRoleFilter(e.target.value)}
            aria-label="Filter role"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Semua role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            aria-label="Filter status"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Semua status</option>
            <option value="AKTIF">Aktif</option>
            <option value="NONAKTIF">Nonaktif</option>
            <option value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
          <form onSubmit={handleSearch} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama/email/HP..."
              className="w-full sm:w-64 rounded-xl border border-slate-300 py-2.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              aria-label="Cari pengguna"
            />
          </form>
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Tutup notifikasi" className="text-emerald-600 hover:text-emerald-800">
            <X size={16} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="h-40 rounded-2xl bg-slate-200 animate-pulse" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Users size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Tidak ada pengguna ditemukan.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Nama</th>
                  <th className="px-5 py-3">Kontak</th>
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Laporan</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Terdaftar</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {u.nama.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 truncate">{u.nama}</span>
                            {isSelf(u.id) && (
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Anda</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-600">{u.email}</p>
                      <p className="text-xs text-slate-400">{u.no_hp || 'Nomor HP belum diisi'}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{u.username || '-'}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        {u._count?.reports ?? 0} laporan
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ${roleBadge(u.role)}`}>
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadge(u.status)}`}>
                        {STATUS_LABEL[u.status] || u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          aria-label={`Edit ${u.nama}`}
                          title={`Edit ${u.nama}`}
                          className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(u)}
                          disabled={isSelf(u.id)}
                          aria-label={`Hapus ${u.nama}`}
                          title={isSelf(u.id) ? 'Tidak dapat menghapus akun sendiri' : `Hapus ${u.nama}`}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL EDIT ==================== */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Edit pengguna ${editing.nama}`}>
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Edit Pengguna</h3>
                <p className="text-xs text-slate-500">Perbarui data profil, role, dan status akun.</p>
              </div>
              <button type="button" onClick={closeEdit} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 px-5 py-5 sm:px-6">
              {modalError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label htmlFor="edit-nama" className="mb-1.5 block text-sm font-semibold text-slate-700">Nama Lengkap</label>
                <input
                  id="edit-nama"
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                  disabled={isSaving}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    disabled={isSaving}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="edit-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">Nomor HP</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={form.no_hp}
                    onChange={(e) => setForm((p) => ({ ...p, no_hp: e.target.value }))}
                    disabled={isSaving}
                    placeholder="08xxxxxxxxxx"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Username <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <input
                  id="edit-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  disabled={isSaving}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-role" className="mb-1.5 block text-sm font-semibold text-slate-700">Role</label>
                  <select
                    id="edit-role"
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                    disabled={isSaving || isSelf(editing.id)}
                    className={inputCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-status" className="mb-1.5 block text-sm font-semibold text-slate-700">Status Akun</label>
                  <select
                    id="edit-status"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    disabled={isSaving || isSelf(editing.id)}
                    className={inputCls}
                  >
                    {!['AKTIF', 'NONAKTIF'].includes(form.status) && (
                      <option value={form.status}>{STATUS_LABEL[form.status] || form.status}</option>
                    )}
                    <option value="AKTIF">Aktif</option>
                    <option value="NONAKTIF">Nonaktif</option>
                  </select>
                </div>
              </div>

              {isSelf(editing.id) ? (
                <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <span>Role dan status akun Anda sendiri tidak dapat diubah dari halaman ini (mencegah akun terkunci).</span>
                </div>
              ) : editing.role === 'admin' ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <span>Akun ini adalah ADMIN. Perubahan role atau penonaktifan akan meminta konfirmasi dan tidak diizinkan jika ini admin aktif terakhir.</span>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
                  {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL HAPUS ==================== */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Konfirmasi hapus ${deleting.nama}`}>
          <div className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className="rounded-xl bg-red-50 p-2 text-red-600">
                <Trash2 size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-900">Hapus Akun?</h3>
                <p className="text-xs text-slate-500">Tindakan ini memerlukan konfirmasi.</p>
              </div>
              <button type="button" onClick={closeDelete} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-bold text-slate-800">{deleting.nama}</p>
                <p className="text-xs text-slate-500">{deleting.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {deleting._count?.reports ?? 0} laporan • Role {ROLE_LABEL[deleting.role] || deleting.role}
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  Jika akun memiliki riwayat (laporan, notifikasi, tugas, atau percakapan), akun akan
                  <strong> dinonaktifkan </strong>
                  dan seluruh data historis tetap tersimpan. Laporan tidak akan dihapus.
                </span>
              </div>

              {deleteError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  {deleteError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={isDeleting}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:bg-red-300"
                >
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {isDeleting ? 'Memproses...' : 'Hapus / Nonaktifkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
