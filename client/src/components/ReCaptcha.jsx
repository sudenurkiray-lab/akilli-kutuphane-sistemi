import { useEffect, useRef, useState, useCallback } from 'react';
import { authApi } from '../api';

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks = [];

function loadRecaptchaScript() {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return new Promise((r) => loadCallbacks.push(r));
  scriptLoading = true;
  return new Promise((resolve) => {
    loadCallbacks.push(resolve);
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function ReCaptcha({ onVerify, resetKey }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const [siteKey, setSiteKey] = useState(null);

  useEffect(() => {
    authApi.recaptchaKey().then((data) => setSiteKey(data.siteKey)).catch(() => {});
  }, []);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.grecaptcha?.render) return;
    if (widgetId.current !== null) {
      try { window.grecaptcha.reset(widgetId.current); } catch {}
      return;
    }
    try {
      widgetId.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => onVerify(token),
        'expired-callback': () => onVerify(''),
        'error-callback': () => onVerify(''),
      });
    } catch {}
  }, [siteKey, onVerify]);

  useEffect(() => {
    if (!siteKey) return;
    loadRecaptchaScript().then(() => {
      if (window.grecaptcha?.render) {
        renderWidget();
      } else {
        window.grecaptcha?.ready?.(() => renderWidget());
      }
    });
  }, [siteKey, renderWidget]);

  useEffect(() => {
    if (widgetId.current !== null && window.grecaptcha) {
      try { window.grecaptcha.reset(widgetId.current); } catch {}
    }
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div className="flex justify-center my-3">
      <div ref={containerRef} />
    </div>
  );
}
