import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge, EmptyState } from '../../components/UI';
import { memberNav } from '../../constants/memberNav';
import { desksApi } from '../../api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const RENK_STYLES = {
  yesil: 'bg-green-500 border-green-400 hover:bg-green-400 text-white cursor-pointer',
  kirmizi: 'bg-red-500/80 border-red-400 text-white cursor-not-allowed opacity-90',
  sari: 'bg-yellow-500 border-yellow-400 hover:bg-yellow-400 text-dark-900 cursor-pointer',
  gri: 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed opacity-70',
};

const RENK_SELECTED = 'ring-2 ring-purple-primary ring-offset-2 ring-offset-dark-800 scale-105';

function DeskCell({ desk, selected, onSelect }) {
  const canSelect = desk.durum === 'bos' || desk.durum === 'yakinda_dolu';
  return (
    <button
      type="button"
      title={`Masa ${desk.masa_no} — ${desk.etiket}`}
      disabled={!canSelect}
      onClick={() => canSelect && onSelect(desk)}
      className={`
        aspect-square rounded-lg border-2 flex flex-col items-center justify-center
        text-xs font-semibold transition-all
        ${RENK_STYLES[desk.renk] || RENK_STYLES.gri}
        ${selected ? RENK_SELECTED : ''}
      `}
    >
      <span>{desk.masa_no}</span>
    </button>
  );
}

export default function MemberDeskReservation() {
  const [tab, setTab] = useState('rezerve');
  const [floors, setFloors] = useState([]);
  const [salons, setSalons] = useState([]);
  const [slots, setSlots] = useState([]);
  const [grid, setGrid] = useState(null);
  const [myReservations, setMyReservations] = useState([]);

  const [katId, setKatId] = useState('');
  const [salonId, setSalonId] = useState('');
  const [tarih, setTarih] = useState(todayStr());
  const [slotKey, setSlotKey] = useState('');
  const [selectedDesk, setSelectedDesk] = useState(null);

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMy = () => desksApi.my().then(setMyReservations).catch(console.error);

  useEffect(() => {
    desksApi.floors().then(setFloors).catch((e) => setMsg(e.message));
    desksApi.slots().then(setSlots).catch(console.error);
    loadMy();
  }, []);

  useEffect(() => {
    if (!katId) { setSalons([]); return; }
    desksApi.salons(katId).then((data) => {
      setSalons(data);
      setSalonId('');
      setGrid(null);
      setSelectedDesk(null);
    }).catch((e) => setMsg(e.message));
  }, [katId]);

  useEffect(() => {
    if (!salonId || !tarih || !slotKey) {
      setGrid(null);
      setSelectedDesk(null);
      return;
    }
    const [baslangic, bitis] = slotKey.split('|');
    setLoading(true);
    desksApi.grid(salonId, tarih, baslangic, bitis)
      .then((data) => { setGrid(data); setSelectedDesk(null); setMsg(''); })
      .catch((e) => { setMsg(e.message); setGrid(null); })
      .finally(() => setLoading(false));
  }, [salonId, tarih, slotKey]);

  const selectedSalon = salons.find((s) => s.id === salonId);
  const selectedSlot = slots.find((s) => `${s.baslangic}|${s.bitis}` === slotKey);
  const pending = myReservations.filter((r) => r.durum === 'onaylandi' || r.durum === 'aktif');

  const handleReserve = async () => {
    if (!selectedDesk || !selectedSlot) return;
    try {
      const result = await desksApi.create({
        desk_id: selectedDesk.id,
        salon_id: salonId,
        tarih,
        baslangic: selectedSlot.baslangic,
        bitis: selectedSlot.bitis,
      });
      setMsg(result.message || 'Masa rezervasyonu oluşturuldu');
      loadMy();
      const [baslangic, bitis] = slotKey.split('|');
      desksApi.grid(salonId, tarih, baslangic, bitis).then(setGrid);
      setSelectedDesk(null);
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await desksApi.cancel(id);
      setMsg('Rezervasyon iptal edildi');
      loadMy();
      if (salonId && slotKey) {
        const [baslangic, bitis] = slotKey.split('|');
        desksApi.grid(salonId, tarih, baslangic, bitis).then(setGrid);
      }
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={memberNav} title="Masa Rezervasyonu">
      <p className="text-gray-400 mb-4">
        Kat, salon ve masa seçerek çalışma masanızı rezerve edin. Masalar renk kodlarıyla gösterilir.
      </p>

      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        {[
          { renk: 'yesil', label: 'Boş' },
          { renk: 'kirmizi', label: 'Dolu' },
          { renk: 'sari', label: 'Yakında dolacak' },
          { renk: 'gri', label: 'Kullanım dışı' },
        ].map((item) => (
          <div key={item.renk} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded border-2 ${RENK_STYLES[item.renk].split(' ').slice(0, 2).join(' ')}`} />
            <span className="text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.includes('oluşturuldu') || msg.includes('iptal')
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
          Masa Rezerve Et
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm">1. Kat</h3>
              <div className="space-y-2">
                {floors.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setKatId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${
                      katId === f.id
                        ? 'border-purple-primary bg-purple-primary/20 text-purple-light'
                        : 'border-dark-600 text-gray-400 hover:border-purple-primary/40'
                    }`}
                  >
                    {f.ad}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm">2. Salon</h3>
              {!katId ? (
                <p className="text-gray-500 text-xs">Önce kat seçin</p>
              ) : (
                <div className="space-y-2">
                  {salons.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSalonId(s.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${
                        salonId === s.id
                          ? 'border-purple-primary bg-purple-primary/20 text-purple-light'
                          : 'border-dark-600 text-gray-400 hover:border-purple-primary/40'
                      }`}
                    >
                      <div className="font-medium">{s.ad}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.aciklama}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm">3. Tarih</h3>
              <input
                type="date"
                className="input w-full text-sm"
                value={tarih}
                min={todayStr()}
                onChange={(e) => setTarih(e.target.value)}
                disabled={!salonId}
              />
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm">4. Saat</h3>
              {!salonId ? (
                <p className="text-gray-500 text-xs">Önce salon seçin</p>
              ) : (
                <select
                  className="input w-full text-sm"
                  value={slotKey}
                  onChange={(e) => setSlotKey(e.target.value)}
                >
                  <option value="">Saat seçin</option>
                  {slots.map((s) => (
                    <option key={s.baslangic} value={`${s.baslangic}|${s.bitis}`}>{s.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-white">5. Masa Seçin</h3>
                {selectedSalon && selectedSlot && (
                  <p className="text-sm text-purple-light mt-1">
                    {selectedSalon.kat_adi} · {selectedSalon.ad} · {selectedSlot.label} ·{' '}
                    {new Date(tarih + 'T12:00:00').toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
              {grid?.ozet && (
                <div className="flex gap-3 text-xs">
                  <span className="text-green-400">{grid.ozet.bos} boş</span>
                  <span className="text-red-400">{grid.ozet.dolu} dolu</span>
                  <span className="text-yellow-400">{grid.ozet.yakinda_dolu} yakında dolacak</span>
                  <span className="text-gray-500">{grid.ozet.kullanim_disi} kapalı</span>
                </div>
              )}
            </div>

            {!salonId || !slotKey ? (
              <p className="text-gray-500 text-center py-16">Kat, salon, tarih ve saat seçtikten sonra masa planı görünür</p>
            ) : loading ? (
              <p className="text-gray-500 text-center py-16">Masalar yükleniyor...</p>
            ) : grid ? (
              <>
                <div
                  className="grid gap-2 max-w-2xl mx-auto mb-6"
                  style={{ gridTemplateColumns: `repeat(${grid.kolon}, minmax(0, 1fr))` }}
                >
                  {grid.desks.map((desk) => (
                    <DeskCell
                      key={desk.id}
                      desk={desk}
                      selected={selectedDesk?.id === desk.id}
                      onSelect={setSelectedDesk}
                    />
                  ))}
                </div>
                {selectedDesk && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-dark-600">
                    <p className="text-sm text-gray-300">
                      Seçilen: <strong className="text-white">Masa {selectedDesk.masa_no}</strong>
                      {selectedDesk.durum === 'yakinda_dolu' && (
                        <span className="text-yellow-400 ml-2">(Sonraki saatte dolacak)</span>
                      )}
                    </p>
                    <button type="button" onClick={handleReserve} className="btn-primary text-sm px-8">
                      Rezervasyon Oluştur
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'benim' && (
        <div className="table-container">
          {myReservations.length === 0 ? (
            <EmptyState message="Henüz masa rezervasyonunuz yok" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kat</th>
                  <th>Salon</th>
                  <th>Masa</th>
                  <th>Tarih</th>
                  <th>Saat</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {myReservations.map((r) => (
                  <tr key={r.id}>
                    <td>{r.kat_adi}</td>
                    <td className="text-white font-medium">{r.salon_adi}</td>
                    <td>Masa {r.masa_no}</td>
                    <td>{new Date(r.tarih + 'T12:00:00').toLocaleDateString('tr-TR')}</td>
                    <td>{r.baslangic} – {r.bitis}</td>
                    <td><StatusBadge status={r.durum} /></td>
                    <td>
                      {(r.durum === 'onaylandi' || r.durum === 'aktif') && (
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
