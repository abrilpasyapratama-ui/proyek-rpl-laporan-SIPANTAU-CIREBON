import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ExternalLink
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../../services/notificationService';
import { AppNotification } from '../../types/notification';
import { getNotificationVisual, formatTimeAgo } from '../../utils/notificationUtils';

interface NotificationBellProps {
  centerPath?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  centerPath = '/notifications'
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Polling unread count secara berkala (tiap 30 detik)
  const refreshUnreadCount = async () => {
    try {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      // Diamkan jika belum login
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ambil daftar notifikasi ketika dropdown dibuka
  const loadDropdownNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchNotifications({
        limit: 8,
        unread_only: activeTab === 'unread'
      });
      setNotifications(res.data);
      setUnreadCount(res.meta.unreadCount);
    } catch (err) {
      console.error('Gagal mengambil notifikasi dropdown:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isOpen) {
      loadDropdownNotifications();
    }
  }, [isOpen, loadDropdownNotifications]);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tandai 1 notifikasi dibaca
  const handleItemClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      try {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
    setIsOpen(false);

    // Navigasi ke halaman terkait berdasarkan tipe notifikasi & area layout
    const isOfficerArea = centerPath.includes('/officer');
    const isAdminArea = centerPath.includes('/admin');
    if (notif.type === 'TUGAS_BARU' || notif.type === 'PERUBAHAN_PRIORITAS') {
      navigate(isOfficerArea ? '/officer/tasks' : isAdminArea ? '/admin/assignments' : '/dashboard');
    } else if (isAdminArea) {
      navigate(
        notif.type === 'LAPORAN_DITERIMA'
          ? '/admin/reports/verification'
          : '/admin/reports'
      );
    } else if (isOfficerArea) {
      navigate('/officer/tasks');
    } else {
      navigate('/reports/history');
    }
  };

  // Tandai semua dibaca
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed mark all read:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Bell Icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition duration-150 focus:outline-none"
        title="Pusat Notifikasi"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Dropdown */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                  {unreadCount} baru
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
                title="Tandai semua telah dibaca"
              >
                <CheckCheck size={14} />
                <span>Tandai Semua</span>
              </button>
            )}
          </div>

          {/* Tab Filter: Semua vs Belum Dibaca */}
          <div className="flex border-b border-slate-100 bg-white px-4 pt-2 gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-2 transition border-b-2 ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`pb-2 transition border-b-2 ${
                activeTab === 'unread'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* Daftar Notifikasi */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
                Memuat notifikasi...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Bell size={18} />
                </div>
                <p className="text-xs font-medium text-slate-600">Tidak ada notifikasi</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeTab === 'unread'
                    ? 'Semua notifikasi sudah Anda baca'
                    : 'Pemberitahuan laporan akan muncul di sini'}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const visual = getNotificationVisual(notif.type);
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start relative ${
                      !notif.is_read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {/* Visual Icon */}
                    <div
                      className={`p-2 rounded-xl border shrink-0 mt-0.5 flex items-center justify-center ${visual.bgColor}`}
                    >
                      {visual.icon}
                    </div>

                    {/* Konten Notifikasi */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4
                          className={`text-xs font-bold leading-tight truncate ${
                            !notif.is_read ? 'text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {notif.judul}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.pesan}
                      </p>
                    </div>

                    {/* Titik Unread Indicator */}
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Dropdown */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(centerPath);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition inline-flex items-center gap-1.5"
            >
              <span>Buka Pusat Notifikasi Lengkap</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
