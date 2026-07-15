import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { formatDate, Modal, StatusBadge } from '../../components/UI';
import { penaltiesApi, membersApi } from '../../api';
import { adminNav } from '../../constants/adminNav';
import { useAuth } from '../../context/AuthContext';

const DURUM_FILTER = [
  { id: 'all', label: 'Tümü' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'taksitli', label: 'Taksitli' },
  { id: 'odendi', label: 'Ödenen' },
  { id: 'iptal', label: 'İptal' },
];

export default function AdminPenalties({ navItems = adminNav, title = 'Ceza Yönetimi' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [penalties, setPenalties] = useState([]);
  const [types, setTypes] = useState([]);
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ user_id: '', tur: 'gecikme', tutar: '', sebep: '', aciklama: '' });
  const [action, setAction] = useState({ type: '', value: '', note: '' });

  const load = () => {
    penaltiesApi.list().then(setPenalties).catch(console.error);
    penaltiesApi.types().then((d) => setTypes(d.turler || [])).catch(console.error);
  };

  useEffect(() => {
    load();
    membersApi.list?.().then(setMembers).catch(() => {});
  }, []);

  const showMsg = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 4000);
  };

  const openDetail = async (id) => {
    try {
      const p = await penaltiesApi.get(id);
      setSelected(p);
      setAction({ type: '', value: '', note: p.aciklama || '' });
    } catch (e) {
      showMsg(e.message);
    }
  };

  const refreshSelected = async (id) => {
    load();
    if (id) await openDetail(id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await penaltiesApi.create({
        ...form,
        user_id: Number(form.user_id),
        tutar: form.tutar ? Number(form.tutar) : undefined,
      });
      showMsg(result.message);
      setCreateOpen(false);
      setForm({ user_id: '', tur: 'gecikme', tutar: '', sebep: '', aciklama: '' });
      load();
    } catch (err) {
      showMsg(err.message);
    }
  };

  const runAction = async () => {
    if (!selected) return;
    try {
      let result;
      const id = selected.id;
      switch (action.type) {
        case 'pay':
          result = await penaltiesApi.pay(id, { aciklama: action.note });
          break;
        case 'cancel':
          result = await penaltiesApi.cancel(id, action.note);
          break;
        case 'discount_amount':
          result = await penaltiesApi.discount(id, { indirim_tutari: Number(action.value), aciklama: action.note });
          break;
        case 'discount_percent':
          result = await penaltiesApi.discount(id, { indirim_orani: Number(action.value), aciklama: action.note });
          break;
        case 'installments':
          result = await penaltiesApi.installments(id, { taksit_sayisi: Number(action.value), aciklama: action.note });
          break;
        case 'note':
          result = await penaltiesApi.note(id, action.note);
          break;
        case 'receipt_approve':
          result = await penaltiesApi.reviewReceipt(id, { onay: true, aciklama: action.note });
          break;
        case 'receipt_reject':
          result = await penaltiesApi.reviewReceipt(id, { onay: false, aciklama: action.note });
          break;
        default:
          return;
      }
      showMsg(result.message);
      await refreshSelected(id);
    } catch (e) {
      showMsg(e.message);
    }
  };

  const payInstallment = async (installmentId) => {
    try {
      const result = await penaltiesApi.pay(selected.id, { installment_id: installmentId });
      showMsg(result.message);
      await refreshSelected(selected.id);
    } catch (e) {
      showMsg(e.message);
    }
  };

  const downloadReceipt = async () => {
    try {
      const blob = await penaltiesApi.downloadReceipt(selected.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selected.dekont_yolu || 'dekont';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showMsg(e.message);
    }
  };

  const filtered = penalties.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'odendi') return p.odendi || p.durum === 'odendi';
    return p.durum === filter;
  });

  const totalUnpaid = penalties
    .filter((p) => !p.odendi && ['aktif', 'taksitli'].includes(p.durum))
    .reduce((s, p) => s + p.tutar, 0);

  return (
    <Layout navItems={navItems} title={title}>
      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm mb-2">
            Gecikme, kayıp, hasar, rezervasyon ihlali ve oda gelmeme cezalarını yönetin.
          </p>
          <div className="card inline-block">
            <p className="text-sm text-gray-400">Toplam Ödenmemiş</p>
            <p className="text-2xl font-bold text-red-400">{totalUnpaid.toFixed(2)} ₺</p>
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          + Yeni Ceza
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {DURUM_FILTER.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filter === f.id ? 'bg-purple-primary text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Tür</th>
              <th>Sebep / Kitap</th>
              <th>Tutar</th>
              <th>Durum</th>
              <th>Dekont</th>
              <th>Tarih</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <p className="font-medium text-white">{p.ad} {p.soyad}</p>
                  <p className="text-xs text-gray-500">{p.okul_no}</p>
                </td>
                <td className="text-sm text-purple-light">{p.tur_adi}</td>
                <td className="text-sm max-w-[200px]">
                  <p className="text-gray-300 truncate">{p.sebep || '-'}</p>
                  {p.kitap_adi && <p className="text-xs text-gray-500 truncate">{p.kitap_adi}</p>}
                </td>
                <td>
                  <p className="text-red-400 font-medium">{p.tutar.toFixed(2)} ₺</p>
                  {p.indirim_tutari > 0 && (
                    <p className="text-xs text-green-400">-{p.indirim_tutari.toFixed(2)} ₺ indirim</p>
                  )}
                </td>
                <td><StatusBadge status={p.durum || (p.odendi ? 'odendi' : 'aktif')} /></td>
                <td>
                  {p.dekont_durumu && p.dekont_durumu !== 'yok'
                    ? <StatusBadge status={p.dekont_durumu} />
                    : <span className="text-gray-600 text-xs">—</span>}
                </td>
                <td className="text-sm">{formatDate(p.tarih)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => openDetail(p.id)}
                    className="text-purple-light hover:text-purple-glow text-sm"
                  >
                    Yönet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Ceza Oluştur">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-sm text-gray-400">Üye ID</label>
            <input
              className="input w-full"
              type="number"
              required
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              placeholder="Örn. ogrenci1 için kullanıcı id"
            />
            {members.length > 0 && (
              <select
                className="input w-full mt-2"
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              >
                <option value="">Üye seç…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.ad} {m.soyad} ({m.okul_no})</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-400">Ceza Türü</label>
            <select
              className="input w-full"
              value={form.tur}
              onChange={(e) => {
                const t = types.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  tur: e.target.value,
                  tutar: t?.varsayilan_tutar != null ? String(t.varsayilan_tutar) : form.tutar,
                });
              }}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.ad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400">Tutar (₺)</label>
            <input
              className="input w-full"
              type="number"
              step="0.01"
              value={form.tutar}
              onChange={(e) => setForm({ ...form, tutar: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Sebep</label>
            <input
              className="input w-full"
              value={form.sebep}
              onChange={(e) => setForm({ ...form, sebep: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Açıklama</label>
            <textarea
              className="input w-full"
              rows={2}
              value={form.aciklama}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary w-full">Oluştur</button>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Ceza Detayı">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Öğrenci</p>
                <p className="text-white">{selected.ad} {selected.soyad}</p>
              </div>
              <div>
                <p className="text-gray-500">Tür</p>
                <p className="text-purple-light">{selected.tur_adi}</p>
              </div>
              <div>
                <p className="text-gray-500">Tutar</p>
                <p className="text-red-400 font-medium">{selected.tutar.toFixed(2)} ₺</p>
                {selected.orijinal_tutar !== selected.tutar && (
                  <p className="text-xs text-gray-500 line-through">{selected.orijinal_tutar?.toFixed(2)} ₺</p>
                )}
              </div>
              <div>
                <p className="text-gray-500">Durum</p>
                <StatusBadge status={selected.durum} />
              </div>
            </div>
            <p className="text-sm text-gray-300">{selected.sebep}</p>
            {selected.kitap_adi && <p className="text-xs text-gray-500">Kitap: {selected.kitap_adi}</p>}

            {selected.taksitler?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-white mb-2">Taksitler</p>
                <ul className="space-y-1">
                  {selected.taksitler.map((t) => (
                    <li key={t.id} className="flex justify-between items-center text-sm py-1 border-b border-dark-600">
                      <span className="text-gray-300">
                        {t.taksit_no}. taksit — {t.tutar.toFixed(2)} ₺
                        <span className="text-gray-500 ml-2">vade: {formatDate(t.vade_tarihi)}</span>
                      </span>
                      {t.odendi ? (
                        <span className="badge-success">Ödendi</span>
                      ) : (
                        <button type="button" className="text-green-400 text-xs" onClick={() => payInstallment(t.id)}>
                          Öde
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.dekont_yolu && (
              <div className="flex items-center gap-3 text-sm">
                <StatusBadge status={selected.dekont_durumu} />
                <button type="button" className="text-purple-light text-sm" onClick={downloadReceipt}>
                  Dekontu İndir
                </button>
              </div>
            )}

            <div>
              <label className="text-sm text-gray-400">İşlem</label>
              <select
                className="input w-full"
                value={action.type}
                onChange={(e) => setAction({ ...action, type: e.target.value })}
                disabled={selected.durum === 'iptal' && action.type !== 'note'}
              >
                <option value="">Seçin…</option>
                {!selected.odendi && selected.durum !== 'iptal' && (
                  <>
                    <option value="pay">Ödendi işaretle</option>
                    <option value="cancel">İptal et</option>
                    {isAdmin && <option value="discount_amount">İndirim (₺)</option>}
                    {isAdmin && <option value="discount_percent">İndirim (%)</option>}
                    {isAdmin && <option value="installments">Taksitlendir</option>}
                  </>
                )}
                <option value="note">Açıklama güncelle</option>
                {selected.dekont_durumu === 'bekliyor' && (
                  <>
                    <option value="receipt_approve">Dekontu onayla</option>
                    <option value="receipt_reject">Dekontu reddet</option>
                  </>
                )}
              </select>
            </div>

            {['discount_amount', 'discount_percent', 'installments'].includes(action.type) && (
              <div>
                <label className="text-sm text-gray-400">
                  {action.type === 'installments' ? 'Taksit sayısı (2–12)' : action.type === 'discount_percent' ? 'İndirim %' : 'İndirim ₺'}
                </label>
                <input
                  className="input w-full"
                  type="number"
                  value={action.value}
                  onChange={(e) => setAction({ ...action, value: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="text-sm text-gray-400">Açıklama / Not</label>
              <textarea
                className="input w-full"
                rows={2}
                value={action.note}
                onChange={(e) => setAction({ ...action, note: e.target.value })}
              />
            </div>

            {action.type && (
              <button type="button" className="btn-primary w-full" onClick={runAction}>
                Uygula
              </button>
            )}

            {selected.loglar?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-white mb-2">İşlem Geçmişi</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
                  {selected.loglar.map((l) => (
                    <li key={l.id} className="text-gray-400 border-b border-dark-700 py-1">
                      <span className="text-purple-light">{l.islem}</span>
                      {l.detay && ` — ${l.detay}`}
                      <span className="text-gray-600 ml-1">({formatDate(l.tarih)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
