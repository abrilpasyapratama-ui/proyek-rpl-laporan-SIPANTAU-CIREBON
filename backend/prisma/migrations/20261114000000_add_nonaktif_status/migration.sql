-- AlterEnum: tambah status NONAKTIF untuk penonaktifan akun (soft delete).
-- Nilai ini dipakai saat akun tidak boleh dihapus permanen karena masih
-- memiliki relasi data historis (laporan, notifikasi, percakapan, dll).
ALTER TYPE "UserStatus" ADD VALUE 'NONAKTIF';
