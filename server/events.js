const EVENT_TYPES = {
  kitap_soylesi: 'Kitap Söyleşisi',
  akademik_egitim: 'Akademik Kaynak Eğitimi',
  yazar_bulusmasi: 'Yazar Buluşması',
  veritabani_egitimi: 'Veri Tabanı Eğitimi',
  sessiz_okuma: 'Sessiz Okuma Etkinliği',
  yazilim_atolyesi: 'Yazılım Atölyesi',
};

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateCertificateCode(eventId, userId) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ETK-${new Date().getFullYear()}-${String(eventId).padStart(3, '0')}-${String(userId).padStart(4, '0')}-${rand}`;
}

function seedEvents(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM library_events').get().c;
  if (count > 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const events = [
    {
      baslik: '“Dijital Çağda Okuma” Kitap Söyleşisi',
      aciklama: 'Yazar Dr. Ayşe Korkmaz ile dijital okuma alışkanlıkları ve edebiyat üzerine söyleşi.',
      tur: 'kitap_soylesi',
      tarih: addDays(today, 7),
      baslangic: '14:00',
      bitis: '16:00',
      konum: 'Merkez Kütüphane — Konferans Salonu',
      kapasite: 50,
      egitmen: 'Dr. Ayşe Korkmaz',
      durum: 'yayinda',
    },
    {
      baslik: 'Akademik Kaynak Kullanımı Eğitimi',
      aciklama: 'IEEE, ScienceDirect ve Google Scholar üzerinden akademik kaynak tarama teknikleri.',
      tur: 'akademik_egitim',
      tarih: addDays(today, 10),
      baslangic: '10:00',
      bitis: '12:00',
      konum: 'Merkez Kütüphane — Dijital Laboratuvar',
      kapasite: 30,
      egitmen: 'Kütüphaneci Ayşe Demir',
      durum: 'yayinda',
    },
    {
      baslik: 'Genç Yazarlar Buluşması',
      aciklama: 'Campus edebiyat kulübü yazarları ile söyleşi ve imza günü.',
      tur: 'yazar_bulusmasi',
      tarih: addDays(today, 14),
      baslangic: '15:00',
      bitis: '17:30',
      konum: 'Mühendislik Kütüphanesi — Etkinlik Alanı',
      kapasite: 40,
      egitmen: 'Edebiyat Kulübü',
      durum: 'yayinda',
    },
    {
      baslik: 'Web of Science & Scopus Veri Tabanı Eğitimi',
      aciklama: 'Atıf analizi, h-index ve literatür taraması uygulamalı eğitim.',
      tur: 'veritabani_egitimi',
      tarih: addDays(today, 5),
      baslangic: '13:00',
      bitis: '15:00',
      konum: 'Hukuk Kütüphanesi — Bilgisayar Lab.',
      kapasite: 25,
      egitmen: 'Arş. Gör. Mehmet Yıldız',
      durum: 'yayinda',
    },
    {
      baslik: 'Sessiz Okuma Saati',
      aciklama: 'Bir saat boyunca telefonsuz, sessiz ortamda kitap okuma etkinliği.',
      tur: 'sessiz_okuma',
      tarih: addDays(today, 3),
      baslangic: '18:00',
      bitis: '19:00',
      konum: 'Merkez Kütüphane — Sessiz Salon A',
      kapasite: 60,
      egitmen: null,
      durum: 'yayinda',
    },
    {
      baslik: 'Python ile Kütüphane Otomasyonu Atölyesi',
      aciklama: 'Temel Python ve veri işleme ile kütüphane senaryoları. Tamamlayanlara katılım belgesi verilir.',
      tur: 'yazilim_atolyesi',
      tarih: addDays(today, -14),
      baslangic: '10:00',
      bitis: '16:00',
      konum: 'Merkez Kütüphane — Dijital Laboratuvar',
      kapasite: 20,
      egitmen: 'Öğr. Gör. Can Öztürk',
      durum: 'tamamlandi',
    },
  ];

  const insert = db.prepare(`
    INSERT INTO library_events (baslik, aciklama, tur, tarih, baslangic, bitis, konum, kapasite, egitmen, durum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  events.forEach((e) => {
    insert.run(e.baslik, e.aciklama, e.tur, e.tarih, e.baslangic, e.bitis, e.konum, e.kapasite, e.egitmen, e.durum);
  });

  // Demo: ogrenci1 attended completed workshop with certificate
  const workshop = db.prepare("SELECT id FROM library_events WHERE tur = 'yazilim_atolyesi'").get();
  const ogrenci1 = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  if (workshop && ogrenci1) {
    const kod = generateCertificateCode(workshop.id, ogrenci1.id);
    db.prepare(`
      INSERT INTO event_registrations (event_id, user_id, durum, sertifika_kodu, sertifika_tarihi)
      VALUES (?, ?, 'katildi', ?, datetime('now'))
    `).run(workshop.id, ogrenci1.id, kod);
  }
}

function enrichEvent(db, event, userId = null) {
  const kayitli = db.prepare(`
    SELECT COUNT(*) as c FROM event_registrations
    WHERE event_id = ? AND durum IN ('kayitli', 'katildi')
  `).get(event.id).c;

  let benim_kayit = null;
  if (userId) {
    benim_kayit = db.prepare(`
      SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?
    `).get(event.id, userId);
  }

  const musait = event.durum === 'yayinda' && kayitli < event.kapasite;
  const gecmis = event.tarih < new Date().toISOString().slice(0, 10);

  return {
    ...event,
    tur_adi: EVENT_TYPES[event.tur] || event.tur,
    kayitli_sayisi: kayitli,
    kalan_kontenjan: Math.max(0, event.kapasite - kayitli),
    musait_kayit: musait && !gecmis,
    gecmis,
    benim_kayit: benim_kayit ? enrichRegistration(db, benim_kayit) : null,
  };
}

function enrichRegistration(db, reg) {
  const event = db.prepare('SELECT * FROM library_events WHERE id = ?').get(reg.event_id);
  const user = db.prepare('SELECT ad, soyad, okul_no, bolum FROM users WHERE id = ?').get(reg.user_id);
  return {
    ...reg,
    etkinlik: event ? {
      ...event,
      tur_adi: EVENT_TYPES[event.tur] || event.tur,
    } : null,
    kullanici: user,
    sertifika_alinabilir: reg.durum === 'katildi' && !!reg.sertifika_kodu,
  };
}

function getCertificateData(db, registrationId, userId, isAdmin) {
  const reg = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(registrationId);
  if (!reg) return { error: 'Kayıt bulunamadı', status: 404 };
  if (!isAdmin && Number(reg.user_id) !== Number(userId)) {
    return { error: 'Bu belgeye erişim yetkiniz yok', status: 403 };
  }
  if (reg.durum !== 'katildi' || !reg.sertifika_kodu) {
    return { error: 'Katılım belgesi henüz oluşturulmamış', status: 400 };
  }

  const user = db.prepare('SELECT ad, soyad, okul_no, bolum FROM users WHERE id = ?').get(reg.user_id);
  const event = db.prepare('SELECT * FROM library_events WHERE id = ?').get(reg.event_id);

  return {
    sertifika: {
      kod: reg.sertifika_kodu,
      tarih: reg.sertifika_tarihi,
      katilimci: `${user.ad} ${user.soyad}`,
      okul_no: user.okul_no,
      bolum: user.bolum,
      etkinlik: event.baslik,
      etkinlik_turu: EVENT_TYPES[event.tur],
      etkinlik_tarihi: event.tarih,
      etkinlik_saati: `${event.baslangic} – ${event.bitis}`,
      konum: event.konum,
      egitmen: event.egitmen,
    },
  };
}

function registerForEvent(db, eventId, userId) {
  const event = db.prepare('SELECT * FROM library_events WHERE id = ?').get(eventId);
  if (!event) return { error: 'Etkinlik bulunamadı', status: 404 };
  if (event.durum !== 'yayinda') return { error: 'Bu etkinliğe kayıt alınmıyor', status: 400 };

  const today = new Date().toISOString().slice(0, 10);
  if (event.tarih < today) return { error: 'Geçmiş etkinliğe kayıt olunamaz', status: 400 };

  const existing = db.prepare('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?').get(eventId, userId);
  if (existing && existing.durum !== 'iptal') {
    return { error: 'Bu etkinliğe zaten kayıtlısınız', status: 400 };
  }

  const kayitli = db.prepare(`
    SELECT COUNT(*) as c FROM event_registrations
    WHERE event_id = ? AND durum IN ('kayitli', 'katildi')
  `).get(eventId).c;
  if (kayitli >= event.kapasite) {
    return { error: 'Kontenjan dolu', status: 400 };
  }

  if (existing?.durum === 'iptal') {
    db.prepare("UPDATE event_registrations SET durum = 'kayitli', kayit_tarihi = datetime('now') WHERE id = ?").run(existing.id);
    return { message: 'Etkinliğe yeniden kayıt oldunuz', id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO event_registrations (event_id, user_id, durum) VALUES (?, ?, 'kayitli')
  `).run(eventId, userId);

  sendNotification(db, userId, 'etkinlik_baslayacak', {
    refId: eventId,
    baslik: 'Etkinlik kaydı',
    mesaj: `"${event.baslik}" etkinliğine kayıt oldunuz. ${event.tarih} ${event.baslangic}`,
    link: '/uye/etkinlikler',
  });

  return { message: 'Etkinliğe kayıt oldunuz', id: result.lastInsertRowid };
}

function markAttendance(db, registrationId, katildi = true) {
  const reg = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(registrationId);
  if (!reg) return { error: 'Kayıt bulunamadı', status: 404 };

  const event = db.prepare('SELECT * FROM library_events WHERE id = ?').get(reg.event_id);
  if (!event) return { error: 'Etkinlik bulunamadı', status: 404 };

  if (katildi) {
    const kod = reg.sertifika_kodu || generateCertificateCode(reg.event_id, reg.user_id);
    db.prepare(`
      UPDATE event_registrations SET durum = 'katildi', sertifika_kodu = ?, sertifika_tarihi = datetime('now')
      WHERE id = ?
    `).run(kod, registrationId);

    sendNotification(db, reg.user_id, 'etkinlik_baslayacak', {
      refId: reg.event_id,
      baslik: 'Katılım belgesi hazır',
      mesaj: `"${event.baslik}" etkinliği için katılım belgeniz oluşturuldu.`,
      link: '/uye/etkinlikler',
    });

    return { message: 'Katılım onaylandı, sertifika oluşturuldu', sertifika_kodu: kod };
  }

  db.prepare("UPDATE event_registrations SET durum = 'katilmadi' WHERE id = ?").run(registrationId);
  return { message: 'Katılmadı olarak işaretlendi' };
}

function completeEvent(db, eventId) {
  const event = db.prepare('SELECT * FROM library_events WHERE id = ?').get(eventId);
  if (!event) return { error: 'Etkinlik bulunamadı', status: 404 };

  db.prepare("UPDATE library_events SET durum = 'tamamlandi' WHERE id = ?").run(eventId);

  const kayitlilar = db.prepare(`
    SELECT * FROM event_registrations WHERE event_id = ? AND durum = 'kayitli'
  `).all(eventId);

  kayitlilar.forEach((reg) => markAttendance(db, reg.id, true));

  return { message: 'Etkinlik tamamlandı, kayıtlı katılımcılara belge verildi', sayi: kayitlilar.length };
}

module.exports = {
  EVENT_TYPES,
  seedEvents,
  enrichEvent,
  enrichRegistration,
  getCertificateData,
  registerForEvent,
  markAttendance,
  completeEvent,
  generateCertificateCode,
};
