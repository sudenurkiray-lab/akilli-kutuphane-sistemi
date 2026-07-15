import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    try {
      const r = await authApi.resetPassword({ token, password });
      setOk(r.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-white text-center">Yeni Şifre Belirle</h1>
        {!token && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
            Geçersiz bağlantı. Önce şifremi unuttum adımını kullanın.
          </div>
        )}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {ok && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">{ok}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Yeni şifre</label>
            <input type="password" className="input" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Yeni şifre (tekrar)</label>
            <input type="password" className="input" minLength={6} value={password2} onChange={(e) => setPassword2(e.target.value)} required />
          </div>
          <button type="submit" className="w-full btn-primary py-3" disabled={loading || !token}>
            {loading ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-purple-light hover:underline">Girişe dön</Link>
        </p>
      </div>
    </div>
  );
}
