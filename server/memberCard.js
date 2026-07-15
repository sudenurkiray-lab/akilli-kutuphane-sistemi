const { generateMemberQr } = require('./scan');
const { unpaidPenaltySum } = require('./advancedPenalties');

function addOneYear(dateStr) {
  const d = new Date(dateStr || Date.now());
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function getMemberCard(db, userId) {
  const user = db.prepare(`
    SELECT id, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu,
           uye_karti_qr, profil_foto, uyelik_bitis_tarihi, created_at
    FROM users WHERE id = ? AND role = 'member'
  `).get(userId);

  if (!user) return null;

  const qr = user.uye_karti_qr || generateMemberQr(user);
  const aktifOdunc = db.prepare(`
    SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum IN ('aktif', 'gecikti')
  `).get(userId).c;

  const toplamCeza = unpaidPenaltySum(db, userId);

  const odenenCeza = db.prepare(`
    SELECT COALESCE(SUM(tutar), 0) as c FROM penalties WHERE user_id = ? AND (odendi = 1 OR durum = 'odendi')
  `).get(userId).c;

  const uyelikBitis = user.uyelik_bitis_tarihi || addOneYear(user.created_at);

  return {
    ad: user.ad,
    soyad: user.soyad,
    ad_soyad: `${user.ad} ${user.soyad}`,
    okul_no: user.okul_no,
    bolum: user.bolum,
    email: user.email,
    telefon: user.telefon,
    uyelik_durumu: user.uyelik_durumu,
    uye_karti_qr: qr,
    qr_url: `https://kutuphane.edu.tr/uye/${qr}`,
    profil_foto: user.profil_foto || null,
    uyelik_bitis_tarihi: uyelikBitis,
    aktif_odunc_sayisi: aktifOdunc,
    toplam_ceza: toplamCeza,
    odenen_ceza: odenenCeza,
    uyelik_suresi_doldu: new Date(uyelikBitis) < new Date(new Date().toISOString().slice(0, 10)),
  };
}

function migrateMembershipDates(db) {
  const members = db.prepare(`
    SELECT id, created_at, uyelik_bitis_tarihi FROM users WHERE role = 'member' AND (uyelik_bitis_tarihi IS NULL OR uyelik_bitis_tarihi = '')
  `).all();
  const update = db.prepare('UPDATE users SET uyelik_bitis_tarihi = ? WHERE id = ?');
  members.forEach((m) => update.run(addOneYear(m.created_at), m.id));
}

module.exports = { getMemberCard, migrateMembershipDates, addOneYear };
