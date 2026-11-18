import React from 'react';
import {
  LayoutDashboard,
  FileCheck2,
  ClipboardCheck,
  ClipboardList,
  Users,
  HardHat,
  UserCheck,
  BarChart3,
  Map,
  Bell,
  Settings,
  UserCircle,
  MessageCircle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ChatbotWidget from '../components/chat/ChatbotWidget';

const navItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={19} />, end: true },
  { name: 'Semua Laporan', path: '/admin/reports', icon: <FileCheck2 size={19} /> },
  { name: 'Verifikasi Laporan', path: '/admin/reports/verification', icon: <ClipboardCheck size={19} /> },
  { name: 'Penugasan Petugas', path: '/admin/assignments', icon: <ClipboardList size={19} /> },
  { name: 'Kelola Pengguna', path: '/admin/users', icon: <Users size={19} /> },
  { name: 'Kelola Petugas', path: '/admin/officers', icon: <HardHat size={19} /> },
  { name: 'Verifikasi Petugas', path: '/admin/verifications', icon: <UserCheck size={19} /> },
  { name: 'Statistik', path: '/admin/statistics', icon: <BarChart3 size={19} /> },
  { name: 'Peta GIS', path: '/admin/map', icon: <Map size={19} /> },
  { name: 'Notifikasi', path: '/admin/notifications', icon: <Bell size={19} /> },
  { name: 'Pengaturan', path: '/admin/settings', icon: <Settings size={19} /> },
  { name: 'Konfigurasi Integrasi', path: '/admin/integrations', icon: <MessageCircle size={19} /> },
  { name: 'Profil', path: '/admin/profile', icon: <UserCircle size={19} /> },
];

const AdminLayout: React.FC = () => (
  <>
    <AppShell title="Panel Admin" navItems={navItems} notificationPath="/admin/notifications" />
    <ChatbotWidget />
  </>
);

export default AdminLayout;
