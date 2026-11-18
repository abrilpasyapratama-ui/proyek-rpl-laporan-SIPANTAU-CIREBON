import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications
} from '../../services/notificationService';
import { AppNotification, NotificationType } from '../../types/notification';
import { getNotificationVisual, formatTimeAgo } from '../../utils/notificationUtils';
import { extractErrorMessage } from '../../utils/apiError';

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedType, setSelectedType] = useState<NotificationType | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetchNotifications({
        page: currentPage,
        limit: 10,
        unread_only: activeTab === 'unread',
        type: selectedType === 'ALL' ? undefined : selectedType
      });
      setNotifications(res.data);
      setUnreadCount(res.meta.unreadCount);
      setTotalCount(res.meta.total);
      setTotalPages(res.meta.totalPages || 1);
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal memuat daftar notifikasi');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, activeTab, selectedType]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      loadNotifications();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus seluruh notifikasi?')) {
      try {
        await clearAllNotifications();
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
      } catch (err) {
        console.error('Error clearing notifications:', err);
      }
    }
  };

  const handleActionClick = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);
    if (notif.type === 'TUGAS_BARU' || notif.type === 'PERUBAHAN_PRIORITAS') {
      navigate('/officer/tasks');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Bell size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Pusat Notifikasi</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {unreadCount} Belum Dibaca
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemberitahuan perubahan status laporan fasilitas dan penugasan perbaikan
            </p>
          </div>
        </div>

        {/* Action Button Header */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
            >
              <CheckCheck size={16} />
              <span>Tandai Semua Dibaca</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
            >
              <Trash2 size={16} />
              <span>Bersihkan</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Tab Semua vs Belum Dibaca */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => {
              setActiveTab('unread');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'unread'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Belum Dibaca ({unreadCount})
          </button>
        </div>

        {/* Filter Jenis Notifikasi */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as NotificationType);
              setCurrentPage(1);
            }}
            className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Semua Kategori Notifikasi</option>
            <option value="LAPORAN_DITERIMA">Laporan Diterima</option>
            <option value="LAPORAN_DIVERIFIKASI">Laporan Diverifikasi</option>
            <option value="LAPORAN_DALAM_PERBAIKAN">Dalam Perbaikan</option>
            <option value="LAPORAN_SELESAI">Laporan Selesai</option>
            <option value="TUGAS_BARU">Tugas Baru (Petugas)</option>
            <option value="PERUBAHAN_PRIORITAS">Perubahan Prioritas</option>
          </select>

          <button
            onClick={() => loadNotifications()}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Konten Daftar Notifikasi */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Bell size={28} />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Tidak ada notifikasi</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'unread'
                ? 'Seluruh notifikasi Anda telah dibaca.'
                : 'Pemberitahuan aktivitas laporan dan perbaikan akan ditampilkan di sini.'}
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const visual = getNotificationVisual(notif.type);
            const fullDate = new Date(notif.created_at).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={notif.id}
                className={`p-5 rounded-2xl border transition-all duration-200 bg-white hover:shadow-md flex flex-col sm:flex-row sm:items-start gap-4 ${
                  !notif.is_read
                    ? 'border-blue-300 ring-2 ring-blue-50/50 bg-blue-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Visual Icon */}
                <div className={`p-3 rounded-2xl border shrink-0 ${visual.bgColor}`}>
                  {visual.icon}
                </div>

                {/* Body Notifikasi */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-bold ${
                          !notif.is_read ? 'text-slate-900' : 'text-slate-800'
                        }`}
                      >
                        {notif.judul}
                      </h3>
                      {!notif.is_read && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                          BARU
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium" title={fullDate}>
                      {formatTimeAgo(notif.created_at)} • {fullDate}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{notif.pesan}</p>

                  {/* Metadata Tag Preview */}
                  {notif.metadata && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {notif.metadata.reportTitle && (
                        <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
                          📌 {notif.metadata.reportTitle}
                        </span>
                      )}
                      {notif.metadata.reportStatus && (
                        <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 font-bold">
                          Status: {notif.metadata.reportStatus}
                        </span>
                      )}
                      {notif.metadata.priority && (
                        <span className="text-[11px] bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-200 font-bold">
                          Prioritas: {notif.metadata.priority}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons Card */}
                <div className="flex items-center sm:flex-col gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleActionClick(notif)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>Buka</span>
                    <ExternalLink size={12} />
                  </button>

                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Hapus Notifikasi"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">
            Halaman <span className="font-bold text-slate-700">{currentPage}</span> dari{' '}
            <span className="font-bold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold transition flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span>Sebelumnya</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold transition flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
