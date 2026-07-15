import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge, EmptyState } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { roomReservationsApi, studyRoomsApi } from '../../api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function RoomBadges({ room }) {
  if (!room) return null;
  const badges = [];
  if (room.sessiz_oda) badges.push({ label: 'Sessiz', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' });
  if (room.grup_odasi) badges.push({ label: 'Grup', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' });
  if (room.akilli_tahta) badges.push({ label: 'Akıllı Tahta', cls: 'bg-green-500/20 text-green-300 border-green-500/30' });
  if (room.bilgisayar) badges.push({ label: 'Bilgisayar', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' });
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {badges.map((b) => (
        <span key={b.label} className={`text-[10px] px-1.5 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
      ))}
    </div>
  );
}

export default function MemberRoomReservation() {
  const [rooms, setRooms] = useState([]);
  const [myReservations, setMyReservations] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [tarih, setTarih] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('rezerve');
  const [filter, setFilter] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadMy = () => roomReservationsApi.my().then(setMyReservations).catch(console.error);

  useEffect(() => {
    studyRoomsApi.list()
      .then((data) => { setRooms(data); setLoadError(''); })
      .catch((e) => setLoadError(e.message || 'Odalar yüklenemedi. Backend çalışıyor mu? (npm run dev)'));
    loadMy();
  }, []);

  useEffect(() => {
    if (!selectedRoom || !tarih) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    roomReservationsApi.slots(selectedRoom, tarih)
      .then((data) => { setSlots(data.slotlar || []); setMsg(''); })
      .catch((e) => { setMsg(e.message); setSlots([]); })
      .finally(() => setLoadingSlots(false));
  }, [selectedRoom, tarih]);

  const selectedRoomInfo = rooms.find((r) => r.id === selectedRoom);
  const pending = myReservations.filter((r) => r.durum === 'beklemede' || r.durum === 'onaylandi');

  const filteredRooms = rooms.filter((r) => {
    if (filter === 'sessiz') return r.sessiz_oda;
    if (filter === 'grup') return r.grup_odasi;
    if (filter === 'bilgisayar') return r.bilgisayar;
    if (filter === 'akilli_tahta') return r.akilli_tahta;
    return true;
  });

  const handleReserve = async (slot) => {
    if (!selectedRoom) return;
    try {
      const result = await roomReservationsApi.create({
        room_id: selectedRoom,
        tarih,
        baslangic: slot.baslangic,
        bitis: slot.bitis,
      });
      setMsg(result.message || 'Çalışma odası rezervasyonu oluşturuldu');
      loadMy();
      roomReservationsApi.slots(selectedRoom, tarih).then((data) => setSlots(data.slotlar || []));
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await roomReservationsApi.cancel(id);
      setMsg('Rezervasyon iptal edildi');
      loadMy();
      if (selectedRoom) {
        roomReservationsApi.slots(selectedRoom, tarih).then((data) => setSlots(data.slotlar || []));
      }
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Çalışma Odası Rezervasyonu">
      <p className="text-gray-400 mb-6">
        Kütüphanedeki çalışma odalarını tarih ve saat seçerek rezerve edin. Çakışan rezervasyonlar otomatik engellenir.
      </p>

      {loadError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-red-500/10 border-red-500/30 text-red-400">
          {loadError}
        </div>
      )}

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('oluşturuldu') || msg.includes('onaylandı') || msg.includes('iptal')
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {msg}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('rezerve')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'rezerve' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Oda Rezerve Et
        </button>
        <button
          type="button"
          onClick={() => setTab('benim')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'benim' ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400'}`}
        >
          Rezervasyonlarım ({pending.length})
        </button>
      </div>

      {tab === 'rezerve' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h3 className="font-semibold text-white mb-3">1. Oda Seçin</h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {[
                  { id: '', label: 'Tümü' },
                  { id: 'sessiz', label: 'Sessiz' },
                  { id: 'grup', label: 'Grup' },
                  { id: 'bilgisayar', label: 'Bilgisayarlı' },
                  { id: 'akilli_tahta', label: 'Akıllı Tahta' },
                ].map((f) => (
                  <button
                    key={f.id || 'all'}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`text-xs px-2 py-1 rounded border ${
                      filter === f.id
                        ? 'border-purple-primary bg-purple-primary/20 text-purple-light'
                        : 'border-dark-600 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoom(room.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedRoom === room.id
                        ? 'border-purple-primary bg-purple-primary/20'
                        : 'border-gray-700 hover:border-purple-primary/40'
                    }`}
                  >
                    <div className="font-medium text-white text-sm">{room.ad}</div>
                    <div className="text-xs text-gray-500">{room.sube} · {room.kat} · Kapasite: {room.kapasite}</div>
                    <div className="text-xs text-gray-400 mt-1">{room.aciklama}</div>
                    <RoomBadges room={room} />
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-4">2. Tarih Seçin</h3>
              <input
                type="date"
                className="input w-full"
                value={tarih}
                min={todayStr()}
                onChange={(e) => setTarih(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-2 card">
            <h3 className="font-semibold text-white mb-1">3. Uygun Saat Seçin</h3>
            {!selectedRoom ? (
              <p className="text-gray-500 py-12 text-center">Önce soldan bir çalışma odası seçin</p>
            ) : (
              <>
                <div className="mb-6 p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                  <p className="text-white font-medium">{selectedRoomInfo?.ad}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedRoomInfo?.sube} · {selectedRoomInfo?.kat} · Kapasite: {selectedRoomInfo?.kapasite} kişi
                  </p>
                  <RoomBadges room={selectedRoomInfo} />
                  <p className="text-sm text-purple-light mt-3">
                    {new Date(tarih + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {loadingSlots ? (
                  <p className="text-gray-500 text-center py-8">Uygun saatler yükleniyor...</p>
                ) : slots.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Saat bilgisi alınamadı</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {slots.map((slot) => (
                      <div
                        key={slot.baslangic}
                        className={`p-4 rounded-lg border ${
                          slot.musait ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        <div className="font-medium text-white">{slot.label}</div>
                        <div className={`text-sm mt-1 ${slot.musait ? 'text-green-400' : 'text-red-400'}`}>
                          {slot.musait ? 'Müsait' : 'Dolu — başka saat seçin'}
                        </div>
                        <button
                          type="button"
                          disabled={!slot.musait}
                          onClick={() => handleReserve(slot)}
                          className="btn-primary w-full mt-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Rezerve Et
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'benim' && (
        <div className="table-container">
          {myReservations.length === 0 ? (
            <EmptyState message="Henüz çalışma odası rezervasyonunuz yok" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Oda</th>
                  <th>Şube</th>
                  <th>Tarih</th>
                  <th>Saat</th>
                  <th>Özellikler</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {myReservations.map((r) => (
                  <tr key={r.id}>
                    <td className="text-white font-medium">{r.oda_adi}</td>
                    <td className="text-sm text-gray-400">{r.sube || '—'}</td>
                    <td>{new Date(r.tarih + 'T12:00:00').toLocaleDateString('tr-TR')}</td>
                    <td>{r.baslangic} – {r.bitis}</td>
                    <td><RoomBadges room={r} /></td>
                    <td><StatusBadge status={r.durum} /></td>
                    <td>
                      {(r.durum === 'beklemede' || r.durum === 'onaylandi') && (
                        <button type="button" onClick={() => handleCancel(r.id)} className="text-red-400 text-sm hover:text-red-300">
                          İptal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Layout>
  );
}
