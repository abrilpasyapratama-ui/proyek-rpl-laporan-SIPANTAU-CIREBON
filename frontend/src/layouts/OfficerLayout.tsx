import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Map,
  Bell,
  UserCircle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ChatbotWidget from '../components/chat/ChatbotWidget';

const navItems = [
  { name: 'Dashboard', path: '/officer/dashboard', icon: <LayoutDashboard size={19} />, end: true },
  { name: 'Tugas Saya', path: '/officer/tasks', icon: <ClipboardList size={19} /> },
  { name: 'Riwayat Penanganan', path: '/officer/history', icon: <History size={19} /> },
  { name: 'Peta GIS', path: '/officer/map', icon: <Map size={19} /> },
  { name: 'Notifikasi', path: '/officer/notifications', icon: <Bell size={19} /> },
  { name: 'Profil', path: '/officer/profile', icon: <UserCircle size={19} /> },
];

const OfficerLayout: React.FC = () => (
  <>
    <AppShell title="Dashboard Petugas" navItems={navItems} notificationPath="/officer/notifications" />
    <ChatbotWidget />
  </>
);

export default OfficerLayout;
