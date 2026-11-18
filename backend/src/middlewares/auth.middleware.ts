import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import prisma from '../utils/db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    status?: string;
    nama?: string;
  };
  file?: Express.Multer.File;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized - Invalid token' });
    }

    // Verify user still exists
    const user = await prisma.users.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized - User not found' });
    }

    req.user = { id: user.id, role: user.role, status: user.status, nama: user.nama };
    next();
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
};

/**
 * Defense in depth: akun yang belum AKTIF (menunggu verifikasi / ditolak)
 * tidak boleh memakai endpoint operasional, walau memegang token valid
 * (mis. token terbit sebelum akun dinonaktifkan).
 */
export const requireActive = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized - No user data' });
  }
  if (req.user.status !== 'AKTIF') {
    return res.status(403).json({
      status: 'error',
      message:
        req.user.status === 'MENUNGGU_VERIFIKASI'
          ? 'Akun Anda menunggu verifikasi Admin.'
          : req.user.status === 'NONAKTIF'
            ? 'Akun Anda dinonaktifkan. Hubungi Admin.'
            : 'Akun Anda tidak aktif. Hubungi Admin.',
    });
  }
  next();
};

export const authorizeRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized - No user data' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden - Insufficient permissions' });
    }

    next();
  };
};
