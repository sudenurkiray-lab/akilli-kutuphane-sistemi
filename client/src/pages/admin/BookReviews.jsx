import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState } from '../../components/UI';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';
import { useAuth } from '../../context/AuthContext';
import { reviewsApi } from '../../api';

export default function AdminBookReviews() {
  const { user } = useAuth();
  const nav = user?.role === 'librarian' ? librarianNav : adminNav;
  const [reported, setReported] = useState([]);
  const [msg, setMsg] = useState('');

  const load = () => reviewsApi.reported().then(setReported).catch((e) => setMsg(e.message));

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Bu yorumu kalıcı olarak kaldırmak istiyor musunuz?')) return;
    try {
      await reviewsApi.remove(id);
      setMsg('Yorum silindi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <Layout navItems={nav} title="Kitap Yorumları — Moderasyon">
      <p className="text-gray-400 mb-6">
        Üyeler tarafından şikâyet edilen yorumları inceleyin ve uygunsuz içerikleri kaldırın.
      </p>

      {msg && (
        <div className="mb-4 bg-purple-primary/10 border border-purple-primary/30 text-purple-light px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {reported.length === 0 ? (
        <EmptyState message="Şikâyet edilen yorum yok" />
      ) : (
        <div className="space-y-3">
          {reported.map((r) => (
            <div key={r.id} className="card border border-orange-500/20">
              <div className="flex justify-between items-start gap-3 mb-2">
                <div>
                  <p className="text-white font-medium">{r.kitap_adi}</p>
                  <p className="text-sm text-gray-400">{r.yazar_ad}</p>
                </div>
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                  {r.sikayet_sayisi} şikâyet
                </span>
              </div>
              {r.spoiler && <span className="text-xs text-yellow-500">Spoiler</span>}
              <p className="text-sm text-gray-300 mt-2">{r.yorum}</p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-500">♥ {r.begeni_sayisi} beğeni</span>
                <button type="button" onClick={() => handleDelete(r.id)} className="btn-secondary text-sm text-red-400">
                  Yorumu Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
