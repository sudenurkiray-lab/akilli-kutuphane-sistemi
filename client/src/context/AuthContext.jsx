import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authApi } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { isValidLocale } from '../i18n/config';

const AuthContext = createContext(null);
const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessageKey, setSessionMessageKey] = useState('');
  const idleTimer = useRef(null);
  const { setLocale } = useLocale();

  const applyUserLocale = useCallback((u) => {
    if (u?.preferred_locale && isValidLocale(u.preferred_locale)) {
      setLocale(u.preferred_locale, { persistRemote: false });
    }
  }, [setLocale]);

  const logout = useCallback((messageKey = '') => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setUser(null);
    if (messageKey) setSessionMessageKey(messageKey);
  }, []);

  const bumpActivity = useCallback(() => {
    if (!localStorage.getItem('token')) return;
    localStorage.setItem('lastActivity', String(Date.now()));
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      logout('session.idleTimeout');
    }, IDLE_MS);
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.me()
        .then((u) => {
          setUser(u);
          applyUserLocale(u);
          const last = Number(localStorage.getItem('lastActivity') || 0);
          if (last && Date.now() - last > IDLE_MS) {
            logout('session.longIdle');
          } else {
            bumpActivity();
          }
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [bumpActivity, logout, applyUserLocale]);

  useEffect(() => {
    if (!user) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return undefined;
    }
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, bumpActivity, { passive: true }));
    bumpActivity();
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, bumpActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, bumpActivity]);

  const login = async (username, password, captcha = {}) => {
    setSessionMessageKey('');
    const data = await authApi.login({
      username,
      password,
      ...captcha,
    });
    if (data.requires_2fa) return data;
    localStorage.setItem('token', data.token);
    setUser(data.user);
    applyUserLocale(data.user);
    bumpActivity();
    return data;
  };

  const complete2FA = async (temp_token, code) => {
    const data = await authApi.login2fa({ temp_token, code });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    applyUserLocale(data.user);
    bumpActivity();
    return data;
  };

  const register = async (data) => {
    const result = await authApi.register(data);
    localStorage.setItem('token', result.token);
    setUser(result.user);
    applyUserLocale(result.user);
    bumpActivity();
    return result;
  };

  const refreshUser = async () => {
    const u = await authApi.me();
    setUser(u);
    return u;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        complete2FA,
        register,
        logout,
        refreshUser,
        loading,
        sessionMessageKey,
        clearSessionMessage: () => setSessionMessageKey(''),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
