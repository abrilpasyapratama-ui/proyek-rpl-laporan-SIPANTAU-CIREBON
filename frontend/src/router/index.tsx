import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuthStore } from '../store/useAuthStore';

// Layouts
import PublicLayout from '../layouts/PublicLayout';
import MasyarakatLayout from '../layouts/MasyarakatLayout';
import AdminLayout from '../layouts/AdminLayout';
import OfficerLayout from '../layouts/OfficerLayout';

// Auth Pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';

// Public Pages
import LandingPage from '../pages/public/LandingPage';
import AboutPage from '../pages/public/AboutPage';
import ContactPage from '../pages/public/ContactPage';

// Masyarakat Pages
import DashboardMasyarakat from '../pages/masyarakat/DashboardMasyarakat';
import BuatLaporan from '../pages/laporan/BuatLaporan';
import RiwayatLaporan from '../pages/laporan/RiwayatLaporan';
import ReportDetailPage from '../pages/laporan/ReportDetailPage';
import ProfilePage from '../pages/shared/ProfilePage';

// Admin Pages
import DashboardAdmin from '../pages/admin/DashboardAdmin';
import ReportManagement from '../pages/admin/ReportManagement';
import AssignmentsPage from '../pages/admin/AssignmentsPage';
import GisDashboard from '../pages/admin/GisDashboard';
import UsersPage from '../pages/admin/UsersPage';
import OfficersPage from '../pages/admin/OfficersPage';
import VerifikasiPetugasPage from '../pages/admin/VerifikasiPetugasPage';
import StatisticsPage from '../pages/admin/StatisticsPage';
import SettingsPage from '../pages/admin/SettingsPage';
import IntegrationsPage from '../pages/admin/IntegrationsPage';

// Petugas Pages
import DashboardOfficer from '../pages/officer/DashboardOfficer';
import TasksPage from '../pages/officer/TasksPage';
import OfficerTaskDetail from '../pages/officer/OfficerTaskDetail';
import HistoryPage from '../pages/officer/HistoryPage';

// Shared Pages
import NotificationCenter from '../pages/notifications/NotificationCenter';

// Error Pages
import NotFoundPage from '../pages/error/NotFoundPage';
import UnauthorizedPage from '../pages/error/UnauthorizedPage';

const roleHome: Record<string, string> = {
  admin: '/admin/dashboard',
  petugas: '/officer/dashboard',
  masyarakat: '/dashboard',
};

const AppRouter: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  // Redirect root ke dashboard sesuai role jika sudah login
  const rootElement = isAuthenticated && user ? (
    <Navigate to={roleHome[user.role] || '/dashboard'} replace />
  ) : (
    <LandingPage />
  );

  const router = createBrowserRouter([
    // ==================== PUBLIC ROUTES ====================
    {
      element: <PublicLayout />,
      children: [
        { path: '/', element: rootElement },
        { path: '/about', element: <AboutPage /> },
        { path: '/contact', element: <ContactPage /> },
        { path: '/map', element: <GisDashboard readonly /> },
      ],
    },
    // Auth (tanpa layout publik — halaman standalone)
    { path: '/login', element: <Login /> },
    { path: '/register', element: <Register /> },

    // ==================== MASYARAKAT ROUTES ====================
    {
      element: <ProtectedRoute allowedRoles={['masyarakat']}><MasyarakatLayout /></ProtectedRoute>,
      children: [
        { path: '/dashboard', element: <DashboardMasyarakat /> },
        { path: '/reports', element: <Navigate to="/reports/history" replace /> },
        { path: '/reports/create', element: <BuatLaporan /> },
        { path: '/reports/history', element: <RiwayatLaporan /> },
        { path: '/reports/:id', element: <ReportDetailPage /> },
        { path: '/notifications', element: <NotificationCenter /> },
        { path: '/profile', element: <ProfilePage /> },
      ],
    },

    // ==================== ADMIN ROUTES ====================
    {
      element: <ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>,
      children: [
        { path: '/admin/dashboard', element: <DashboardAdmin /> },
        { path: '/admin/reports', element: <ReportManagement /> },
        { path: '/admin/reports/verification', element: <ReportManagement initialStatus="MENUNGGU_VERIFIKASI" title="Verifikasi Laporan" /> },
        { path: '/admin/assignments', element: <AssignmentsPage /> },
        { path: '/admin/users', element: <UsersPage /> },
        { path: '/admin/officers', element: <OfficersPage /> },
        { path: '/admin/verifications', element: <VerifikasiPetugasPage /> },
        { path: '/admin/statistics', element: <StatisticsPage /> },
        { path: '/admin/settings', element: <SettingsPage /> },
        { path: '/admin/integrations', element: <IntegrationsPage /> },
        { path: '/admin/map', element: <GisDashboard /> },
        { path: '/admin/notifications', element: <NotificationCenter /> },
        { path: '/admin/profile', element: <ProfilePage /> },
        { path: '/admin/gis', element: <Navigate to="/admin/map" replace /> },
        { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
      ],
    },

    // ==================== PETUGAS ROUTES ====================
    {
      element: <ProtectedRoute allowedRoles={['petugas']}><OfficerLayout /></ProtectedRoute>,
      children: [
        { path: '/officer/dashboard', element: <DashboardOfficer /> },
        { path: '/officer/tasks', element: <TasksPage /> },
        { path: '/officer/tasks/:id', element: <OfficerTaskDetail /> },
        { path: '/officer/history', element: <HistoryPage /> },
        { path: '/officer/map', element: <GisDashboard readonly /> },
        { path: '/officer/notifications', element: <NotificationCenter /> },
        { path: '/officer/profile', element: <ProfilePage /> },
        { path: '/officer', element: <Navigate to="/officer/dashboard" replace /> },
      ],
    },

    // ==================== REDIRECT URL LAMA ====================
    { path: '/gis', element: <Navigate to="/map" replace /> },
    { path: '/notifikasi', element: <Navigate to="/notifications" replace /> },
    { path: '/laporan/buat', element: <Navigate to="/reports/create" replace /> },

    // ==================== ERROR ROUTES ====================
    { path: '/unauthorized', element: <UnauthorizedPage reason="forbidden" /> },
    { path: '/session-expired', element: <UnauthorizedPage reason="session" /> },
    { path: '*', element: <NotFoundPage /> },
  ]);

  return <RouterProvider router={router} />;
};

export default AppRouter;
