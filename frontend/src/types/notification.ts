export type NotificationType =
  | 'LAPORAN_DITERIMA'
  | 'LAPORAN_DIVERIFIKASI'
  | 'LAPORAN_DIPROSES'
  | 'LAPORAN_DALAM_PERBAIKAN'
  | 'LAPORAN_SELESAI'
  | 'TUGAS_BARU'
  | 'PERUBAHAN_PRIORITAS'
  | 'SISTEM';

export interface AppNotification {
  id: string;
  user_id: string;
  report_id?: string | null;
  type: NotificationType;
  judul: string;
  pesan: string;
  is_read: boolean;
  read_at?: string | null;
  metadata?: {
    reportTitle?: string;
    reportLocation?: string;
    reportStatus?: string;
    kategori?: string;
    priority?: string;
    prioritasLama?: string;
    prioritasBaru?: string;
    catatan?: string;
    isApproved?: boolean;
    [key: string]: unknown;
  } | null;
  created_at: string;
  report?: {
    id: string;
    judul: string;
    kategori: string;
    status: string;
    foto?: string | null;
  } | null;
}

export interface NotificationResponse {
  status: string;
  data: AppNotification[];
  meta: {
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
