import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  History,
  Map,
  Bell,
  UserCircle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ChatbotWidget from '../components/chat/ChatbotWidget';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={19} />, end: true },
  { name: 'Buat Laporan', path: '/reports/create', icon: <FilePlus2 size={19} /> },
  { name: 'Riwayat Laporan', path: '/reports/history', icon: <History size={19} /> },
  { name: 'Peta GIS', path: '/map', icon: <Map size={19} /> },
  { name: 'Notifikasi', path: '/notifications', icon: <Bell size={19} /> },
  { name: 'Profil', path: '/profile', icon: <UserCircle size={19} /> },
];

const MasyarakatLayout: React.FC = () => (
  <>
    <AppShell title="Dashboard Masyarakat" navItems={navItems} notificationPath="/notifications" />
    <ChatbotWidget />
  </>
);

export default MasyarakatLayout;
