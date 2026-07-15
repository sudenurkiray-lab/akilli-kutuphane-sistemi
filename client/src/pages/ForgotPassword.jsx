import { useState } from 'react';
import { Link } from 'react-router-dom';
import CaptchaField from '../components/CaptchaField';
import ReCaptcha from '../components/ReCaptcha';
import { authApi } from '../api';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!username && !email) {
      setError('Kullanıcı adı veya e-posta girin');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.forgotPassword({
        username: username || undefined,
        email: email || undefined,
        captcha_id: captchaId,
        captcha_answer: captchaAnswer,
        recaptcha_token: recaptchaToken,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-white text-center">Şifremi Unuttum</h1>
        <p className="text-sm text-gray-400 text-center">
          Eşleşen hesap için sıfırlama bağlantısı oluşturulur (demo ortamında ekranda da gösterilir).
        </p>
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {result && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm space-y-2">
            <p>{result.message}</p>
            {result.demo_reset_url && (
              <Link to={result.demo_reset_url} className="block text-purple-light hover:underline break-all">
                Sıfırlama bağlantısı (demo)
              </Link>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Kullanıcı adı</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="örn. ogrenci1" />
          </div>
          <div>
            <label className="label">veya e-posta</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <CaptchaField
            key={captchaKey}
            value={captchaAnswer}
            onChange={setCaptchaAnswer}
            idValue={captchaId}
            onIdChange={setCaptchaId}
          />

          <ReCaptcha
            onVerify={setRecaptchaToken}
            resetKey={captchaKey}
          />
          <button type="submit" className="w-full btn-primary py-3" disabled={loading}>
            {loading ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı oluştur'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-purple-light hover:underline">Girişe dön</Link>
        </p>
      </div>
    </div>
  );
}
