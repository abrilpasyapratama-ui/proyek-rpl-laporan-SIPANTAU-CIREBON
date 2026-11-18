import React from 'react';
import {
  Bell,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Briefcase,
  FileText,
} from 'lucide-react';
import { NotificationType } from '../types/notification';

// Helper visual untuk icon & warna per jenis notifikasi
export const getNotificationVisual = (type: NotificationType) => {
  switch (type) {
    case 'LAPORAN_DITERIMA':
      return {
        icon: <FileText size={16} className="text-blue-600" />,
        bgColor: 'bg-blue-50 border-blue-200',
        badgeColor: 'bg-blue-100 text-blue-800'
      };
    case 'LAPORAN_DIVERIFIKASI':
      return {
        icon: <CheckCircle2 size={16} className="text-teal-600" />,
        bgColor: 'bg-teal-50 border-teal-200',
        badgeColor: 'bg-teal-100 text-teal-800'
      };
    case 'LAPORAN_DIPROSES':
    case 'LAPORAN_DALAM_PERBAIKAN':
      return {
        icon: <Wrench size={16} className="text-purple-600" />,
        bgColor: 'bg-purple-50 border-purple-200',
        badgeColor: 'bg-purple-100 text-purple-800'
      };
    case 'LAPORAN_SELESAI':
      return {
        icon: <CheckCircle2 size={16} className="text-emerald-600" />,
        bgColor: 'bg-emerald-50 border-emerald-200',
        badgeColor: 'bg-emerald-100 text-emerald-800'
      };
    case 'TUGAS_BARU':
      return {
        icon: <Briefcase size={16} className="text-orange-600" />,
        bgColor: 'bg-orange-50 border-orange-200',
        badgeColor: 'bg-orange-100 text-orange-800'
      };
    case 'PERUBAHAN_PRIORITAS':
      return {
        icon: <AlertTriangle size={16} className="text-red-600" />,
        bgColor: 'bg-red-50 border-red-200',
        badgeColor: 'bg-red-100 text-red-800'
      };
    default:
      return {
        icon: <Bell size={16} className="text-slate-600" />,
        bgColor: 'bg-slate-50 border-slate-200',
        badgeColor: 'bg-slate-100 text-slate-800'
      };
  }
};

// Format waktu relatif (contoh: "Baru saja", "5 mnt lalu", "2 jam lalu", "Kemarin")
export const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSec < 60) return 'Baru saja';
  if (diffInSec < 3600) return `${Math.floor(diffInSec / 60)} mnt lalu`;
  if (diffInSec < 86400) return `${Math.floor(diffInSec / 3600)} jam lalu`;
  if (diffInSec < 172800) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};
