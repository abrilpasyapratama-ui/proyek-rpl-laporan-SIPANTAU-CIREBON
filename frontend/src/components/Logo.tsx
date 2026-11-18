import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Logo aplikasi: pin peta + gedung fasilitas publik.
 * SVG inline agar tajam di semua resolusi & tanpa aset eksternal.
 */
const Logo: React.FC<LogoProps> = ({ size = 44, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Logo Sistem Pelaporan Fasilitas Umum"
    className={className}
  >
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2563eb" />
        <stop offset="1" stopColor="#1e40af" />
      </linearGradient>
    </defs>
    {/* Map pin */}
    <path
      d="M32 6c-8.837 0-16 7.163-16 16 0 11.2 16 28 16 28s16-16.8 16-28c0-8.837-7.163-16-16-16z"
      fill="url(#logoGrad)"
    />
    <circle cx="32" cy="22" r="13" fill="#ffffff" opacity="0.18" />
    {/* Gedung fasilitas */}
    <g fill="#ffffff">
      <rect x="24" y="15" width="16" height="14" rx="1.5" />
      <rect x="26.5" y="18" width="3" height="3" rx="0.6" fill="#2563eb" />
      <rect x="31" y="18" width="3" height="3" rx="0.6" fill="#2563eb" />
      <rect x="26.5" y="23" width="3" height="3" rx="0.6" fill="#2563eb" />
      <rect x="31" y="23" width="3" height="3" rx="0.6" fill="#2563eb" />
      <rect x="29.4" y="24.5" width="1.6" height="4.5" rx="0.4" fill="#2563eb" />
    </g>
    {/* Garis jalan */}
    <path d="M14 50h36" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
  </svg>
);

export default Logo;
