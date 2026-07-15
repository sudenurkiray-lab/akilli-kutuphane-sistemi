import { useState } from 'react';
import Layout from '../../components/Layout';
import { notificationsApi } from '../../api';
import { adminNav } from '../../constants/adminNav';

export default function AdminAnnouncements() {
  const [form, setForm] = useState({ baslik: '', mesaj: '', hedef: 'members' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await notificationsApi.announce(form);
      setMsg(result.message);
      setForm({ baslik: '', mesaj: '', hedef: 'members' });
      setTimeout(() => setMsg(''), 5000);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout navItems={adminNav} title="Sistem Duyuruları">
      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      <p className="text-gray-400 mb-6">
        Tüm üyelere veya tüm kullanıcılara sistem duyurusu gönderin. Bildirim kanalları kullanıcı tercihlerine göre iletilir.
      </p>

      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        <div>
          <label className="label">Başlık</label>
          <input
            className="input w-full"
            value={form.baslik}
            onChange={(e) => setForm({ ...form, baslik: e.target.value })}
            placeholder="Örn. Final dönemi çalışma saatleri"
            required
          />
        </div>
        <div>
          <label className="label">Mesaj</label>
          <textarea
            className="input w-full"
            rows={4}
            value={form.mesaj}
            onChange={(e) => setForm({ ...form, mesaj: e.target.value })}
            placeholder="Duyuru metni..."
            required
          />
        </div>
        <div>
          <label className="label">Hedef Kitle</label>
          <select
            className="input w-full"
            value={form.hedef}
            onChange={(e) => setForm({ ...form, hedef: e.target.value })}
          >
            <option value="members">Yalnızca üyeler (öğrenciler)</option>
            <option value="all">Tüm kullanıcılar (admin + kütüphaneci dahil)</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Gönderiliyor…' : 'Duyuru Gönder'}
        </button>
      </form>
    </Layout>
  );
}
