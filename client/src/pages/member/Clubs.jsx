import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { memberNav } from '../../constants/memberNav';
import { clubApi, booksApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LocaleContext';

function ClubCard({ club, onSelect, t }) {
  return (
    <div
      onClick={() => onSelect(club)}
      className="bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 cursor-pointer transition-all overflow-hidden"
    >
      {club.kapak_resmi ? (
        <img src={club.kapak_resmi} alt={club.ad} className="w-full h-36 object-cover" />
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-blue-700 to-purple-700 flex items-center justify-center">
          <span className="text-5xl">📚</span>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-bold text-lg text-white mb-1">{club.ad}</h3>
        <p className="text-gray-400 text-sm line-clamp-2 mb-3">{club.aciklama || t('clubs.noDescription')}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>👥 {club.uye_sayisi} {t('clubs.memberCount')}</span>
          {club.kurucu && <span>{t('clubs.founder')}: {club.kurucu.ad} {club.kurucu.soyad}</span>}
        </div>
        {club.aylik_kitap && (
          <div className="mt-2 p-2 bg-blue-900/30 rounded text-xs text-blue-300">
            📖 {t('clubs.monthlyBook')}: {club.aylik_kitap.kitap_adi}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateClubModal({ open, onClose, onCreated, t }) {
  const [form, setForm] = useState({ ad: '', aciklama: '', kapak_resmi: '', max_uye: 50 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await clubApi.create(form);
      if (result.error) { setError(result.error); return; }
      onCreated(result);
      onClose();
      setForm({ ad: '', aciklama: '', kapak_resmi: '', max_uye: 50 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">{t('clubs.createClub')}</h2>
        {error && <div className="bg-red-900/40 text-red-300 p-2 rounded mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-gray-300">{t('clubs.clubName')} *</label>
            <input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} required
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="text-sm text-gray-300">{t('clubs.description')}</label>
            <textarea value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="text-sm text-gray-300">{t('clubs.coverImage')} (URL)</label>
            <input value={form.kapak_resmi} onChange={(e) => setForm({ ...form, kapak_resmi: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm text-gray-300">{t('clubs.maxMembers')}</label>
            <input type="number" value={form.max_uye} onChange={(e) => setForm({ ...form, max_uye: +e.target.value })} min={2} max={200}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded py-2 font-medium disabled:opacity-50">
              {loading ? t('common.loading') : t('clubs.create')}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white rounded py-2">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MeetingForm({ clubId, onCreated, t }) {
  const [form, setForm] = useState({ baslik: '', tarih: '', saat: '', yer: '', aciklama: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await clubApi.createMeeting(clubId, form);
      if (result.error) { setError(result.error); return; }
      onCreated(result);
      setForm({ baslik: '', tarih: '', saat: '', yer: '', aciklama: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-700/50 rounded-lg p-4 space-y-3 mb-4">
      <h4 className="text-sm font-semibold text-gray-200">{t('clubs.newMeeting')}</h4>
      {error && <div className="text-red-400 text-xs">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <input value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} required
          placeholder={t('clubs.meetingTitle')} className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
        <input type="date" value={form.tarih} onChange={(e) => setForm({ ...form, tarih: e.target.value })} required
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
        <input value={form.saat} onChange={(e) => setForm({ ...form, saat: e.target.value })}
          placeholder={t('clubs.time')} className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
        <input value={form.yer} onChange={(e) => setForm({ ...form, yer: e.target.value })}
          placeholder={t('clubs.location')} className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
      </div>
      <button type="submit" className="bg-green-600 hover:bg-green-700 text-white text-sm rounded px-4 py-1.5">
        {t('clubs.addMeeting')}
      </button>
    </form>
  );
}

function MonthlyBookSelector({ clubId, onSelected, t }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const data = await booksApi.list({ search, limit: 10 });
      setResults(Array.isArray(data) ? data : data.books || []);
    } catch { setResults([]); }
    setLoading(false);
  };

  const handleSelect = async (bookId) => {
    try {
      await clubApi.setMonthlyBook(clubId, bookId);
      onSelected();
      setSearch('');
      setResults([]);
    } catch {}
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
      <h4 className="text-sm font-semibold text-gray-200">{t('clubs.selectMonthlyBook')}</h4>
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder={t('clubs.searchBook')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
        <button type="button" onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded px-3 py-1.5">
          {loading ? '...' : t('common.search')}
        </button>
      </div>
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {results.map((b) => (
            <div key={b.id} className="flex items-center justify-between bg-gray-700 rounded p-2 text-sm">
              <span className="text-gray-200">{b.ad} — <span className="text-gray-400">{b.yazar}</span></span>
              <button onClick={() => handleSelect(b.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs rounded px-2 py-1">
                {t('clubs.selectBook')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscussionPanel({ clubId, isMember, t }) {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setDiscussions(await clubApi.getDiscussions(clubId));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [clubId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    try {
      await clubApi.addDiscussion(clubId, {
        baslik: replyTo ? null : newTitle || null,
        mesaj: newMsg,
        parent_id: replyTo || null,
      });
      setNewMsg('');
      setNewTitle('');
      setReplyTo(null);
      load();
    } catch {}
  };

  const handleDelete = async (id) => {
    try { await clubApi.deleteDiscussion(id); load(); } catch {}
  };

  if (loading) return <div className="text-gray-400 text-sm">{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      {isMember && (
        <form onSubmit={handleSend} className="bg-gray-700/50 rounded-lg p-4 space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-blue-300">
              <span>{t('clubs.replyingTo')} #{replyTo}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-red-400">✕</button>
            </div>
          )}
          {!replyTo && (
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('clubs.topicTitle')} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
          )}
          <div className="flex gap-2">
            <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} required
              placeholder={t('clubs.writeMessage')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded px-3 py-1.5">
              {t('clubs.send')}
            </button>
          </div>
        </form>
      )}

      {discussions.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">{t('clubs.noDiscussions')}</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((thread) => (
            <div key={thread.id} className="bg-gray-700/30 rounded-lg p-4">
              {thread.baslik && <h4 className="font-semibold text-blue-300 text-sm mb-1">{thread.baslik}</h4>}
              <p className="text-gray-200 text-sm">{thread.mesaj}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>{thread.yazar_ad} {thread.yazar_soyad}</span>
                <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                {thread.yazar_rol && <span className="bg-gray-600 px-1.5 py-0.5 rounded text-gray-300">{thread.yazar_rol}</span>}
                {isMember && (
                  <button onClick={() => setReplyTo(thread.id)} className="text-blue-400 hover:underline">{t('clubs.reply')}</button>
                )}
                {(thread.user_id === user?.id) && (
                  <button onClick={() => handleDelete(thread.id)} className="text-red-400 hover:underline">{t('common.delete')}</button>
                )}
              </div>

              {thread.replies?.length > 0 && (
                <div className="ms-4 mt-3 space-y-2 border-s-2 border-gray-600 ps-3">
                  {thread.replies.map((reply) => (
                    <div key={reply.id}>
                      <p className="text-gray-300 text-sm">{reply.mesaj}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{reply.yazar_ad} {reply.yazar_soyad}</span>
                        <span>{new Date(reply.created_at).toLocaleDateString()}</span>
                        {(reply.user_id === user?.id) && (
                          <button onClick={() => handleDelete(reply.id)} className="text-red-400 hover:underline">{t('common.delete')}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClubDetail({ club, onBack, onRefresh, t }) {
  const { user } = useAuth();
  const isMember = !!club.benim_uyeligim;
  const isAdmin = club.benim_uyeligim?.rol === 'kurucu' || club.benim_uyeligim?.rol === 'moderator';
  const [tab, setTab] = useState('overview');
  const [monthlyBooks, setMonthlyBooks] = useState([]);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    if (tab === 'books') {
      clubApi.getMonthlyBooks(club.id).then(setMonthlyBooks).catch(() => {});
    }
  }, [tab, club.id]);

  const handleJoin = async () => {
    setJoinLoading(true);
    try {
      const result = await clubApi.join(club.id);
      if (!result.error) onRefresh();
    } catch {}
    setJoinLoading(false);
  };

  const handleLeave = async () => {
    try {
      const result = await clubApi.leave(club.id);
      if (!result.error) onRefresh();
    } catch {}
  };

  const tabs = [
    { id: 'overview', label: t('clubs.overview') },
    { id: 'members', label: t('clubs.members') },
    { id: 'books', label: t('clubs.monthlyBooks') },
    { id: 'meetings', label: t('clubs.meetings') },
    { id: 'discussion', label: t('clubs.discussion') },
  ];

  return (
    <div>
      <button onClick={onBack} className="text-blue-400 hover:underline text-sm mb-4">← {t('common.back')}</button>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6">
        {club.kapak_resmi ? (
          <img src={club.kapak_resmi} alt={club.ad} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-gradient-to-r from-blue-700 via-purple-700 to-pink-700 flex items-center justify-center">
            <span className="text-7xl">📚</span>
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{club.ad}</h2>
              <p className="text-gray-400 mt-1">{club.aciklama}</p>
              <div className="flex gap-4 text-sm text-gray-500 mt-2">
                <span>👥 {club.uye_sayisi} {t('clubs.memberCount')}</span>
                {club.kurucu && <span>{t('clubs.founder')}: {club.kurucu.ad} {club.kurucu.soyad}</span>}
              </div>
            </div>
            <div>
              {!isMember ? (
                <button onClick={handleJoin} disabled={joinLoading}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-5 py-2 font-medium disabled:opacity-50">
                  {joinLoading ? '...' : t('clubs.joinClub')}
                </button>
              ) : club.benim_uyeligim?.rol !== 'kurucu' ? (
                <button onClick={handleLeave} className="bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg px-4 py-2 text-sm">
                  {t('clubs.leaveClub')}
                </button>
              ) : (
                <span className="bg-yellow-600/20 text-yellow-400 rounded-lg px-4 py-2 text-sm">{t('clubs.founderBadge')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === tb.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          {club.aylik_kitap && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="font-semibold text-blue-400 mb-2">📖 {t('clubs.currentMonthlyBook')}</h3>
              <p className="text-white font-medium">{club.aylik_kitap.kitap_adi}</p>
              <p className="text-gray-400 text-sm">{club.aylik_kitap.yazar}</p>
              {club.aylik_kitap.secen_ad && (
                <p className="text-gray-500 text-xs mt-1">{t('clubs.selectedBy')}: {club.aylik_kitap.secen_ad} {club.aylik_kitap.secen_soyad}</p>
              )}
            </div>
          )}
          {club.toplantilar?.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="font-semibold text-green-400 mb-2">📅 {t('clubs.upcomingMeetings')}</h3>
              {club.toplantilar.filter((m) => m.durum === 'planlanmis').slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-200">{m.baslik}</span>
                  <span className="text-gray-500">{m.tarih} {m.saat && `• ${m.saat}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="divide-y divide-gray-700">
            {club.uyeler?.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-white">{m.ad} {m.soyad}</span>
                  {m.okul_no && <span className="text-gray-500 text-sm ms-2">({m.okul_no})</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  m.rol === 'kurucu' ? 'bg-yellow-600/20 text-yellow-400' :
                  m.rol === 'moderator' ? 'bg-blue-600/20 text-blue-400' :
                  'bg-gray-600/40 text-gray-400'
                }`}>
                  {m.rol === 'kurucu' ? t('clubs.founderRole') : m.rol === 'moderator' ? t('clubs.moderatorRole') : t('clubs.memberRole')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'books' && (
        <div className="space-y-4">
          {isAdmin && <MonthlyBookSelector clubId={club.id} onSelected={() => { onRefresh(); clubApi.getMonthlyBooks(club.id).then(setMonthlyBooks); }} t={t} />}
          {monthlyBooks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">{t('clubs.noMonthlyBooks')}</p>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="divide-y divide-gray-700">
                {monthlyBooks.map((mb) => (
                  <div key={mb.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{mb.kitap_adi}</span>
                      <span className="text-gray-400 text-sm ms-2">— {mb.yazar}</span>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-blue-400">{mb.ay}</span>
                      {mb.secen_ad && <span className="text-gray-500 ms-2">({mb.secen_ad})</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'meetings' && (
        <div className="space-y-4">
          {isAdmin && <MeetingForm clubId={club.id} onCreated={onRefresh} t={t} />}
          {club.toplantilar?.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">{t('clubs.noMeetings')}</p>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="divide-y divide-gray-700">
                {club.toplantilar.map((m) => (
                  <div key={m.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{m.baslik}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        m.durum === 'planlanmis' ? 'bg-blue-600/20 text-blue-400' :
                        m.durum === 'tamamlandi' ? 'bg-green-600/20 text-green-400' :
                        'bg-red-600/20 text-red-400'
                      }`}>
                        {m.durum === 'planlanmis' ? t('clubs.planned') : m.durum === 'tamamlandi' ? t('clubs.completed') : t('clubs.cancelled')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      📅 {m.tarih} {m.saat && `⏰ ${m.saat}`} {m.yer && `📍 ${m.yer}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'discussion' && <DiscussionPanel clubId={club.id} isMember={isMember} t={t} />}
    </div>
  );
}

export default function MemberClubs() {
  const { user } = useAuth();
  const t = useT();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedClub, setSelectedClub] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadClubs = async () => {
    setLoading(true);
    try {
      const data = await clubApi.list({ search: search || undefined, durum: 'aktif' });
      setClubs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Clubs load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadClubs(); }, []);

  const handleSearch = () => loadClubs();

  const refreshSelected = async () => {
    if (!selectedClub) return;
    try {
      const updated = await clubApi.get(selectedClub.id);
      setSelectedClub(updated);
      loadClubs();
    } catch {}
  };

  const filtered = filter === 'my'
    ? clubs.filter((c) => c.benim_uyeligim)
    : clubs;

  return (
    <Layout navItems={memberNav} titleKey="nav.member.clubs">
      <div className="max-w-6xl mx-auto">
        {selectedClub ? (
          <ClubDetail club={selectedClub} onBack={() => { setSelectedClub(null); loadClubs(); }} onRefresh={refreshSelected} t={t} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">{t('clubs.title')}</h1>
              <button onClick={() => setShowCreate(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium text-sm">
                + {t('clubs.createClub')}
              </button>
            </div>

            <div className="flex gap-3 mb-6">
              <div className="flex-1 flex gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t('clubs.searchPlaceholder')}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white" />
                <button onClick={handleSearch} className="bg-gray-600 hover:bg-gray-500 text-white rounded-lg px-4 py-2">
                  {t('common.search')}
                </button>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {t('common.all')}
                </button>
                <button onClick={() => setFilter('my')}
                  className={`px-3 py-2 rounded-lg text-sm ${filter === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {t('clubs.myClubs')}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-12">{t('common.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <span className="text-5xl block mb-3">📚</span>
                <p>{t('clubs.noClubs')}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((club) => (
                  <ClubCard key={club.id} club={club} onSelect={setSelectedClub} t={t} />
                ))}
              </div>
            )}

            <CreateClubModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={(newClub) => { loadClubs(); setSelectedClub(newClub); }} t={t} />
          </>
        )}
      </div>
    </Layout>
  );
}
