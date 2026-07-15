import { useEffect, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge } from '../../components/UI';
import QrDisplay from '../../components/QrDisplay';
import ReturnInspectionModal from '../../components/ReturnInspectionModal';
import { scanApi, returnInspectionsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { adminNav } from '../../constants/adminNav';
import { librarianNav } from '../../constants/librarianNav';

const MODES = [
  { id: 'odunc', label: 'Ödünç Ver', hint: 'Önce üye kartı, sonra kitap okutun' },
  { id: 'iade', label: 'Teslim Al', hint: 'Kitap barkodunu okutun' },
  { id: 'hasar', label: 'Hasar Kaydı', hint: 'Hasarlı kitabın barkodunu okutun' },
  { id: 'bilgi', label: 'Bilgi', hint: 'Üye veya kitap kodu okutun' },
];

const DURUM_LABEL = {
  rafta: 'Rafta (müsait)',
  oduncte: 'Ödünçte',
  hasarli: 'Hasarlı',
  kayip: 'Kayıp',
  rezerve: 'Rezerve',
  bakimda: 'Bakımda',
};

export default function Scanner() {
  const { user } = useAuth();
  const nav = user?.role === 'admin' ? adminNav : librarianNav;
  const inputRef = useRef(null);
  const [mode, setMode] = useState('odunc');
  const [scanValue, setScanValue] = useState('');
  const [member, setMember] = useState(null);
  const [copyInfo, setCopyInfo] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [damageNote, setDamageNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [pendingReturnCode, setPendingReturnCode] = useState(null);
  const [pendingReturnInfo, setPendingReturnInfo] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);

  useEffect(() => {
    returnInspectionsApi.conditions().then((d) => setConditions(d.durumlar || [])).catch(console.error);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, member]);

  const showMsg = (text, type = 'info') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  };

  const resetSession = () => {
    setMember(null);
    setCopyInfo(null);
    setScanValue('');
    setDamageNote('');
    inputRef.current?.focus();
  };

  const handleLookup = async (code) => {
    const result = await scanApi.lookup(code);
    if (result.type === 'member') {
      setMember(result.member);
      setCopyInfo(null);
      showMsg(`Üye: ${result.member.ad} ${result.member.soyad}`, 'success');
      return result;
    }
    if (result.type === 'copy') {
      setCopyInfo(result.copy);
      showMsg(`Kitap: ${result.copy.kitap_adi}`, 'success');
      return result;
    }
    return result;
  };

  const processScan = async (raw) => {
    const code = raw.trim();
    if (!code) return;
    setLoading(true);
    try {
      if (mode === 'bilgi') {
        await handleLookup(code);
        setScanValue('');
        return;
      }

      if (mode === 'iade') {
        const lookup = await scanApi.lookup(code);
        if (lookup.type !== 'copy') {
          showMsg('Geçerli bir kitap barkodu okutun', 'error');
          return;
        }
        setPendingReturnCode(code);
        setPendingReturnInfo(lookup.copy);
        setScanValue('');
        return;
      }

      if (mode === 'hasar') {
        const result = await scanApi.damage(code, damageNote);
        showMsg(result.message, 'success');
        resetSession();
        return;
      }

      const lookup = await scanApi.lookup(code);

      if (lookup.type === 'member') {
        setMember(lookup.member);
        setCopyInfo(null);
        showMsg(`Üye seçildi: ${lookup.member.ad} ${lookup.member.soyad}. Şimdi kitabı okutun.`, 'success');
        setScanValue('');
        return;
      }

      if (lookup.type === 'copy') {
        setCopyInfo(lookup.copy);
        if (!member) {
          showMsg('Önce öğrenci kartını okutun', 'error');
          setScanValue('');
          return;
        }
        const lend = await scanApi.lend(member.uye_karti_qr, code);
        showMsg(`${lend.message}: ${lend.loan.kitap} → ${lend.loan.uye}`, 'success');
        resetSession();
        return;
      }

      showMsg('Kod tanınmadı', 'error');
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setLoading(false);
      setScanValue('');
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    processScan(scanValue);
  };

  const handleReturnSubmit = async (inspection) => {
    if (!pendingReturnCode) return;
    setReturnLoading(true);
    try {
      const result = await scanApi.return(pendingReturnCode, inspection);
      let text = result.message;
      if (result.penalty) text += ` — Gecikme: ${result.penalty.tutar} ₺`;
      if (result.hasar_cezasi) text += ` — ${result.hasar_cezasi.durum_adi}: ${result.hasar_cezasi.tutar} ₺`;
      showMsg(text, 'success');
      setPendingReturnCode(null);
      setPendingReturnInfo(null);
      resetSession();
    } catch (e) {
      throw e;
    } finally {
      setReturnLoading(false);
    }
  };

  const currentMode = MODES.find((m) => m.id === mode);

  return (
    <Layout navItems={nav} title="QR / Barkod Tarama">
      <p className="text-gray-400 mb-6">
        USB barkod okuyucu veya QR kod ile hızlı ödünç, teslim ve hasar işlemleri.
      </p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msgType === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : msgType === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-purple-primary/10 border-purple-primary/30 text-purple-light'
        }`}>{msg}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setMode(m.id); resetSession(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === m.id
                ? 'bg-purple-primary/20 text-purple-light border border-purple-primary/30'
                : 'bg-dark-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-2">{currentMode?.label}</h3>
          <p className="text-gray-400 text-sm mb-4">{currentMode?.hint}</p>

          {mode === 'odunc' && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${member ? 'bg-green-500/20 text-green-400' : 'bg-purple-primary/20 text-purple-light'}`}>1</span>
              <span className={member ? 'text-green-400' : 'text-gray-300'}>Üye kartı {member ? '✓' : ''}</span>
              <span className="text-gray-600 mx-1">→</span>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${member ? 'bg-purple-primary/20 text-purple-light' : 'bg-dark-600 text-gray-500'}`}>2</span>
              <span className="text-gray-300">Kitap barkodu</span>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <label className="block text-sm text-gray-400 mb-2">Barkod / QR kod</label>
            <input
              ref={inputRef}
              type="text"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder={mode === 'odunc' && !member ? 'Üye kartı okutun (UYE-...)' : 'Barkod okutun...'}
              className="input w-full font-mono text-lg mb-4"
              autoComplete="off"
              disabled={loading}
            />
            {mode === 'hasar' && (
              <textarea
                value={damageNote}
                onChange={(e) => setDamageNote(e.target.value)}
                placeholder="Hasar açıklaması (isteğe bağlı)"
                className="input w-full mb-4 min-h-[80px]"
              />
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? 'İşleniyor...' : 'Okut / Onayla'}
              </button>
              <button type="button" onClick={resetSession} className="btn-secondary">Sıfırla</button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {member && (
            <div className="card">
              <h4 className="text-white font-semibold mb-3">Seçili Üye</h4>
              <div className="flex gap-4 items-start">
                <QrDisplay value={member.qr_url || `https://kutuphane.edu.tr/uye/${member.uye_karti_qr}`} size={100} />
                <div>
                  <p className="text-white text-lg font-medium">{member.ad} {member.soyad}</p>
                  <p className="text-gray-400 text-sm">Okul No: {member.okul_no}</p>
                  <p className="text-gray-500 text-sm font-mono">{member.uye_karti_qr}</p>
                  <p className="text-gray-400 text-sm">{member.bolum}</p>
                  <StatusBadge status={member.uyelik_durumu} />
                </div>
              </div>
            </div>
          )}

          {copyInfo && (
            <div className="card">
              <h4 className="text-white font-semibold mb-3">Kitap Bilgisi</h4>
              <div className="flex gap-4 items-start">
                <QrDisplay value={copyInfo.qr_kod} size={100} label={copyInfo.barkod} />
                <div className="flex-1">
                  <p className="text-white text-lg font-medium">{copyInfo.kitap_adi}</p>
                  <p className="text-gray-400 text-sm">{copyInfo.yazar} · {copyInfo.kategori}</p>
                  <p className="text-gray-500 text-sm font-mono mt-1">{copyInfo.barkod} · Kopya #{copyInfo.kopya_no}</p>
                  <p className="text-gray-400 text-sm mt-1">
                    {copyInfo.sube} · {copyInfo.kat} · Raf {copyInfo.raf_no || '—'}
                    {copyInfo.oda_adi && ` · ${copyInfo.oda_adi}`}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      copyInfo.musait ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {copyInfo.musait ? 'Müsait' : DURUM_LABEL[copyInfo.fiziksel_durum] || copyInfo.fiziksel_durum}
                    </span>
                  </div>
                  {copyInfo.aktif_odunc && (
                    <p className="text-sm text-orange-400 mt-2">
                      Ödünçte: {copyInfo.aktif_odunc.ad} {copyInfo.aktif_odunc.soyad}
                      ({copyInfo.aktif_odunc.okul_no}) — Teslim: {new Date(copyInfo.aktif_odunc.teslim_tarihi).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!member && !copyInfo && (
            <div className="card text-center py-12 text-gray-500">
              <p className="text-4xl mb-3">📷</p>
              <p>Barkod okuyucuyu hazırlayın ve kod okutun</p>
              <p className="text-sm mt-2 text-gray-600">Üye: UYE-2021001 · Kitap: KTP-00327-01</p>
            </div>
          )}
        </div>
      </div>

      <ReturnInspectionModal
        open={!!pendingReturnCode}
        onClose={() => { setPendingReturnCode(null); setPendingReturnInfo(null); }}
        onSubmit={handleReturnSubmit}
        conditions={conditions}
        loading={returnLoading}
        subtitle={pendingReturnInfo ? `"${pendingReturnInfo.kitap_adi}" — ${pendingReturnInfo.barkod}` : ''}
      />
    </Layout>
  );
}
