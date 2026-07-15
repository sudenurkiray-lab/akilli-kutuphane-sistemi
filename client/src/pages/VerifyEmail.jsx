import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setError('Doğrulama tokenı bulunamadı.');
      return;
    }
    authApi.verifyEmail(token)
      .then((r) => setOk(r.message))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-white">E-posta Doğrulama</h1>
        {loading && <p className="text-gray-400 text-sm">Doğrulanıyor…</p>}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {ok && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">{ok}</div>}
        <Link to="/login" className="text-purple-light hover:underline text-sm">Girişe dön</Link>
      </div>
    </div>
  );
}
