import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { extractErrorMessage } from '../../utils/apiError';

// Catatan: Pastikan untuk menginstall dependency berikut:
// npm install leaflet react-leaflet
// npm install -D @types/leaflet
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix untuk marker default icon Leaflet di React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Komponen helper untuk mengambil klik di Map
interface LocationMarkerProps {
  position: L.LatLng | null;
  setPosition: (pos: L.LatLng) => void;
}

const LocationMarker = ({ position, setPosition }: LocationMarkerProps) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

const BuatLaporan: React.FC = () => {
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  // Ambil lokasi awal pengguna (GPS) jika diizinkan
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude));
        },
        () => {
          // Default ke pusat Cirebon jika gagal
          setPosition(new L.LatLng(-6.7320, 108.5523));
        }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) {
      setError('Harap tentukan lokasi kerusakan pada peta.');
      return;
    }
    
    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('judul', judul);
      formData.append('kategori', kategori);
      formData.append('deskripsi', deskripsi);
      formData.append('lokasi', lokasi);
      formData.append('latitude', position.lat.toString());
      formData.append('longitude', position.lng.toString());
      if (foto) {
        formData.append('foto', foto);
      }

      await api.post('/reports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      navigate('/dashboard'); // Kembali ke riwayat laporan
    } catch (err) {
      setError(extractErrorMessage(err) || 'Gagal mengirim laporan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Buat Laporan Baru</h1>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Judul Laporan</label>
              <input type="text" required value={judul} onChange={e => setJudul(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" placeholder="Contoh: Jalan Berlubang di Jl. Kartini" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Kategori</label>
              <select required value={kategori} onChange={e => setKategori(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border">
                <option value="">Pilih Kategori...</option>
                <option value="Jalan">Jalan & Jembatan</option>
                <option value="Penerangan">Penerangan Jalan</option>
                <option value="Sanitasi">Sanitasi & Gorong-gorong</option>
                <option value="Gedung">Gedung Publik</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Deskripsi Detail</label>
              <textarea required value={deskripsi} onChange={e => setDeskripsi(e.target.value)} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" placeholder="Jelaskan kondisi kerusakan secara detail..."></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Alamat Deskriptif (Opsional)</label>
              <input type="text" required value={lokasi} onChange={e => setLokasi(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" placeholder="Jl. Kartini Raya No 10" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Upload Foto Bukti</label>
              <input type="file" accept="image/jpeg, image/png, image/jpg" onChange={e => setFoto(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Tandai Lokasi di Peta</label>
            <p className="text-xs text-gray-500 mb-2">Geser dan klik pada peta untuk menandai titik koordinat kerusakan yang akurat.</p>
            <div className="h-[400px] w-full rounded-md overflow-hidden border border-gray-300">
              {position && (
                <MapContainer center={position} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker position={position} setPosition={setPosition} />
                </MapContainer>
              )}
            </div>
            {position && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                Latitude: {position.lat.toFixed(6)}, Longitude: {position.lng.toFixed(6)}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 font-medium">
            {isLoading ? 'Mengirim...' : 'Kirim Laporan'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BuatLaporan;
