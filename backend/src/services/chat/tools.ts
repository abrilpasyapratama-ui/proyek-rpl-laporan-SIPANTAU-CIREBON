/**
 * Definisi function-calling tools untuk Asisten SIPANTAU.
 * LLM hanya menerima definisi ini — eksekusi selalu lewat service layer
 * (chatQuery.service.ts) dengan permission check. LLM tidak pernah
 * menyentuh database secara langsung.
 */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

const REPORT_STATUSES = [
  'MENUNGGU_VERIFIKASI',
  'DIPROSES',
  'DALAM_PERBAIKAN',
  'SELESAI',
  'DITOLAK',
];

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'getMyProfile',
      description:
        'Mengambil PROFIL PEMANGGIL SENDIRI dari database (nama, email, nomor HP, peran, sejak akun terdaftar). Gunakan HANYA untuk pertanyaan tentang identitas diri pemanggil ("siapa saya", "email saya", "role saya", "nomor HP saya", "sejak kapan terdaftar"). Jangan gunakan untuk profil pengguna lain.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAdminProfile',
      description:
        'HANYA untuk role ADMIN: mengambil profil administrator yang sedang login beserta jabatan, ringkasan hak akses, dan ringkasan sistem. Gunakan untuk pertanyaan "bagaimana profil administrator saya", "apa jabatan saya", "hak akses saya apa".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReportStatus',
      description:
        'Untuk menanyakan STATUS SATU laporan spesifik (sertakan report_id jika diketahui) atau status laporan terbaru pemanggil. Jangan gunakan untuk pertanyaan agregat/jumlah.',
      parameters: {
        type: 'object',
        properties: {
          report_id: { type: 'string', description: 'ID laporan (UUID). Opsional.' },
          limit: { type: 'string', description: 'Jumlah laporan terbaru jika tanpa report_id (1-20, default 5). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReportsByCategory',
      description: 'HANYA untuk MENDAFTAR laporan ketika pengguna menyebut kategori tertentu (misal: Penerangan Jalan, Jalan & Jembatan, Air & Drainase). Bukan untuk menghitung jumlah.',
      parameters: {
        type: 'object',
        properties: {
          kategori: { type: 'string', description: 'Nama kategori yang dicari.' },
          status: { type: 'string', description: 'Filter status.', enum: REPORT_STATUSES },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: ['kategori'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReportsByLocation',
      description:
        'HANYA untuk MENDAFTAR laporan ketika pengguna menyebut lokasi/kecamatan tertentu (misal: Siliwangi, Karanggetas, Kejaksan). Bukan untuk menghitung jumlah.',
      parameters: {
        type: 'object',
        properties: {
          lokasi: { type: 'string', description: 'Kata kunci lokasi/kecamatan.' },
          status: { type: 'string', description: 'Filter status.', enum: REPORT_STATUSES },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: ['lokasi'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserReports',
      description:
        'Mengambil ringkasan laporan: milik sendiri untuk masyarakat, laporan yang ditugaskan untuk petugas, seluruh laporan terbaru untuk admin.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter status.', enum: REPORT_STATUSES },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDashboardStatistics',
      description:
        'WAJIB digunakan untuk SEMUA pertanyaan tentang JUMLAH/ANGKA agregat: total laporan, laporan belum ditangani/menunggu verifikasi, laporan prioritas tinggi, performa petugas, dan ringkasan dashboard.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getOfficerTasks',
      description:
        'Mengambil daftar tugas penanganan: tugas milik sendiri untuk petugas, seluruh penugasan terbaru untuk admin. Tidak tersedia untuk masyarakat.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter status laporan tugas.', enum: REPORT_STATUSES },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getNotifications',
      description: 'Mengambil ringkasan notifikasi milik pengguna yang sedang chat (jumlah belum dibaca + terbaru).',
      parameters: {
        type: 'object',
        properties: {
          unread_only: { type: 'string', description: '"true" untuk hanya yang belum dibaca. Opsional.' },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 5). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchReports',
      description:
        'Mencari laporan berdasarkan kata kunci bebas (judul/deskripsi/alamat), rentang tanggal, kategori, atau status. Gunakan untuk "cari laporan ...", "laporan minggu lalu", "laporan tanggal ...".',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Kata kunci (judul/deskripsi/alamat). Opsional.' },
          kategori: { type: 'string', description: 'Filter kategori. Opsional.' },
          lokasi: { type: 'string', description: 'Filter lokasi. Opsional.' },
          status: { type: 'string', description: 'Filter status.', enum: REPORT_STATUSES },
          date_from: { type: 'string', description: 'Tanggal awal YYYY-MM-DD. Opsional.' },
          date_to: { type: 'string', description: 'Tanggal akhir YYYY-MM-DD. Opsional.' },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReportAnalytics',
      description:
        'WAJIB untuk "kategori apa yang paling banyak", "wilayah mana yang terbanyak", "prioritas terbanyak", atau distribusi laporan. Menghitung jumlah laporan dikelompokkan.',
      parameters: {
        type: 'object',
        properties: {
          group_by: {
            type: 'string',
            description: 'Dimensi pengelompokan.',
            enum: ['kategori', 'lokasi', 'prioritas', 'status'],
          },
          status: { type: 'string', description: 'Batasi pada status tertentu.', enum: REPORT_STATUSES },
          period_days: { type: 'string', description: 'Hanya N hari terakhir (mis. 30). Opsional.' },
          limit: { type: 'string', description: 'Jumlah kelompok teratas (1-20, default 10). Opsional.' },
        },
        required: ['group_by'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReportPeriodSummary',
      description:
        'WAJIB untuk "berapa laporan minggu ini / bulan ini" dan perbandingan antar periode. Mengembalikan jumlah laporan periode berjalan, rincian per status, dan periode sebelumnya.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description: 'Periode ringkasan.',
            enum: ['hari', 'minggu', 'bulan'],
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getResolutionTime',
      description:
        'Menghitung rata-rata waktu penyelesaian laporan (jam & hari) dari laporan berstatus SELESAI. Gunakan untuk "rata-rata waktu penyelesaian".',
      parameters: {
        type: 'object',
        properties: {
          period_days: { type: 'string', description: 'Batasi ke laporan N hari terakhir. Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getHighPriorityReports',
      description:
        'Menampilkan DAFTAR laporan prioritas tinggi (Tinggi/Darurat) yang belum selesai. Untuk "laporan prioritas tinggi yang belum selesai".',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUnassignedReports',
      description:
        'Menampilkan DAFTAR laporan yang belum memiliki petugas (belum ditugaskan). Hanya untuk admin.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReportsNearby',
      description:
        'Menampilkan laporan di sekitar koordinat tertentu (GIS). Gunakan jika pengguna menyebut titik koordinat latitude/longitude.',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'string', description: 'Lintang (-90 s.d. 90).' },
          longitude: { type: 'string', description: 'Bujur (-180 s.d. 180).' },
          radius_km: { type: 'string', description: 'Radius km (0.5-50, default 3). Opsional.' },
          limit: { type: 'string', description: 'Jumlah hasil (1-20, default 10). Opsional.' },
        },
        required: ['latitude', 'longitude'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getOfficerSummary',
      description:
        'Ringkasan petugas: jumlah petugas terdaftar/aktif dan performa (tugas & selesai) per petugas. Untuk "berapa petugas terdaftar", "performa petugas". Hanya untuk admin.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserSummary',
      description:
        'Ringkasan jumlah pengguna per peran (masyarakat/petugas/admin). Untuk "berapa pengguna terdaftar". Hanya untuk admin.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

export const CHAT_TOOL_NAMES = CHAT_TOOLS.map((t) => t.function.name);
