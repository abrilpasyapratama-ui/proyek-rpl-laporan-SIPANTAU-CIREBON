import { Router } from 'express';
import { getGisReports, getGisCategories } from '../controllers/gis.controller';

const router = Router();

// Endpoint utama GIS (Publik & Terbuka untuk dashboard)
// Mendukung filter status, kategori, pencarian q, bbox koordinat, dan format GeoJSON
router.get('/', getGisReports);
router.get('/reports', getGisReports);
router.get('/categories', getGisCategories);

export default router;
