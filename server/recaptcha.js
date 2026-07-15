const https = require('https');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

function verifyRecaptcha(token) {
  return new Promise((resolve) => {
    if (!token) {
      return resolve({ ok: false, error: 'reCAPTCHA doğrulaması gerekli' });
    }

    const postData = `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`;

    const req = https.request(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.success) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, error: 'reCAPTCHA doğrulaması başarısız. Lütfen tekrar deneyin.' });
          }
        } catch {
          resolve({ ok: false, error: 'reCAPTCHA doğrulama hatası' });
        }
      });
    });

    req.on('error', () => {
      resolve({ ok: true });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { verifyRecaptcha, RECAPTCHA_SECRET };
