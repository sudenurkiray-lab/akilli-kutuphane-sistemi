function migrateClubsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad TEXT NOT NULL,
      aciklama TEXT,
      kapak_resmi TEXT,
      kurucu_id INTEGER NOT NULL,
      durum TEXT DEFAULT 'aktif' CHECK(durum IN ('aktif','pasif','arsiv')),
      max_uye INTEGER DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kurucu_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS club_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rol TEXT DEFAULT 'uye' CHECK(rol IN ('kurucu','moderator','uye')),
      katilim_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(club_id, user_id),
      FOREIGN KEY (club_id) REFERENCES clubs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS club_monthly_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      ay TEXT NOT NULL,
      secen_id INTEGER,
      notlar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (club_id) REFERENCES clubs(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (secen_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS club_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      baslik TEXT NOT NULL,
      tarih TEXT NOT NULL,
      saat TEXT,
      yer TEXT,
      aciklama TEXT,
      durum TEXT DEFAULT 'planlanmis' CHECK(durum IN ('planlanmis','tamamlandi','iptal')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (club_id) REFERENCES clubs(id)
    );

    CREATE TABLE IF NOT EXISTS club_discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      baslik TEXT,
      mesaj TEXT NOT NULL,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (club_id) REFERENCES clubs(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES club_discussions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);
    CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_club_discussions_club ON club_discussions(club_id);
    CREATE INDEX IF NOT EXISTS idx_club_monthly_club ON club_monthly_books(club_id);
    CREATE INDEX IF NOT EXISTS idx_club_meetings_club ON club_meetings(club_id);
  `);
}

function seedClubsDemo(db) {
  if (db.prepare('SELECT COUNT(*) as c FROM clubs').get().c > 0) return;

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const ogrenci = db.prepare("SELECT id FROM users WHERE username = 'ogrenci1'").get();
  if (!admin || !ogrenci) return;

  const clubs = [
    { ad: 'Klasik Edebiyat Kulübü', aciklama: 'Türk ve dünya klasiklerini birlikte okuyoruz. Tolstoy\'dan Yaşar Kemal\'e, Dostoyevski\'den Orhan Pamuk\'a geniş bir yelpazede eserler tartışıyoruz.', kurucu: admin.id, max_uye: 40 },
    { ad: 'Bilim Kurgu Okurları', aciklama: 'Sci-fi severler için aylık kitap seçimi ve tartışma. Asimov, Clarke, Philip K. Dick ve günümüz yazarlarını keşfediyoruz.', kurucu: ogrenci.id, max_uye: 35 },
    { ad: 'Felsefe ve Düşünce Atölyesi', aciklama: 'Antik Yunan\'dan modern düşünürlere kadar felsefi eserleri okuyup tartışıyoruz. Platon, Nietzsche, Sartre ve daha fazlası.', kurucu: admin.id, max_uye: 30 },
    { ad: 'Polisiye & Gerilim Severler', aciklama: 'Agatha Christie\'den Haruki Murakami\'ye, polisiye ve gerilim türündeki en iyi eserleri birlikte okuyoruz.', kurucu: ogrenci.id, max_uye: 45 },
    { ad: 'Şiir ve Söz Sanatı', aciklama: 'Şiir okuma, yazma ve paylaşma kulübü. Nazım Hikmet, Cemal Süreya, Turgut Uyar ve dünya şiirinden seçmeler.', kurucu: admin.id, max_uye: 25 },
    { ad: 'Tarih Okurları Topluluğu', aciklama: 'Tarihi romanlar ve akademik tarih kitaplarını tartışıyoruz. Osmanlı\'dan Cumhuriyet\'e, Antik Roma\'dan modern dünyaya.', kurucu: ogrenci.id, max_uye: 40 },
    { ad: 'Psikoloji ve Kişisel Gelişim', aciklama: 'Psikoloji, davranış bilimi ve kişisel gelişim alanındaki en etkili kitapları birlikte okuyup deneyimlerimizi paylaşıyoruz.', kurucu: admin.id, max_uye: 50 },
    { ad: 'Manga & Çizgi Roman Kulübü', aciklama: 'Manga, çizgi roman ve grafik novel severler için. One Piece\'ten Maus\'a, Naruto\'dan Watchmen\'e kadar geniş bir koleksiyon.', kurucu: ogrenci.id, max_uye: 60 },
    { ad: 'Dünya Edebiyatı Gezginleri', aciklama: 'Her ay farklı bir ülkenin edebiyatından bir eser seçiyoruz. Latin Amerika, Japonya, Rusya, Afrika ve daha fazlası.', kurucu: admin.id, max_uye: 35 },
    { ad: 'Startup & Girişimcilik Okuma Grubu', aciklama: 'İş dünyası, girişimcilik, liderlik ve inovasyon üzerine kitaplar okuyoruz. Steve Jobs, Elon Musk biyografileri ve daha fazlası.', kurucu: ogrenci.id, max_uye: 30 },
    { ad: 'Fantastik Dünyalar Kulübü', aciklama: 'Yüzüklerin Efendisi, Harry Potter, Eragon ve fantastik edebiyatın en iyi eserlerini tartışıyoruz.', kurucu: admin.id, max_uye: 55 },
    { ad: 'Çevre ve Doğa Kitapları', aciklama: 'İklim değişikliği, sürdürülebilirlik ve doğa üzerine kitaplar okuyoruz. Rachel Carson\'dan günümüz çevre yazarlarına.', kurucu: ogrenci.id, max_uye: 20 },
  ];

  const insertClub = db.prepare('INSERT INTO clubs (ad, aciklama, kurucu_id, max_uye) VALUES (?, ?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO club_members (club_id, user_id, rol) VALUES (?, ?, ?)');
  const insertMeeting = db.prepare('INSERT INTO club_meetings (club_id, baslik, tarih, saat, yer, aciklama) VALUES (?, ?, ?, ?, ?, ?)');
  const insertDiscussion = db.prepare('INSERT INTO club_discussions (club_id, user_id, baslik, mesaj, parent_id) VALUES (?, ?, ?, ?, ?)');
  const insertMonthlyBook = db.prepare('INSERT INTO club_monthly_books (club_id, book_id, ay, secen_id, notlar) VALUES (?, ?, ?, ?, ?)');

  const clubIds = [];
  for (const c of clubs) {
    const r = insertClub.run(c.ad, c.aciklama, c.kurucu, c.max_uye);
    const cid = r.lastInsertRowid;
    clubIds.push(cid);
    insertMember.run(cid, c.kurucu, 'kurucu');
    const otherUser = c.kurucu === admin.id ? ogrenci.id : admin.id;
    insertMember.run(cid, otherUser, 'uye');
  }

  const books = db.prepare('SELECT id FROM books LIMIT 12').all();
  const ay = new Date().toISOString().slice(0, 7);
  const prevAy = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();

  clubIds.forEach((cid, i) => {
    if (books[i]) {
      insertMonthlyBook.run(cid, books[i].id, ay, clubs[i].kurucu, null);
    }
    if (books[(i + 1) % books.length]) {
      insertMonthlyBook.run(cid, books[(i + 1) % books.length].id, prevAy, clubs[i].kurucu, 'Geçen ayın kitabıydı.');
    }
  });

  const meetingData = [
    { baslik: 'Aylık Tartışma', saat: '18:00', yer: 'Çalışma Odası 2', aciklama: 'Bu ayın kitabını konuşuyoruz.' },
    { baslik: 'Bilim Kurgu Maratonu', saat: '19:00', yer: 'Konferans Salonu A', aciklama: 'Favori bilim kurgu filmlerini de konuşacağız.' },
    { baslik: 'Felsefe Sohbeti', saat: '17:30', yer: 'Kütüphane Toplantı Odası', aciklama: 'Varoluşçuluk üzerine serbest tartışma.' },
    { baslik: 'Gerilim Gecesi', saat: '20:00', yer: 'Online (Zoom)', aciklama: 'En sevdiğimiz gerilim sahnelerini paylaşıyoruz.' },
    { baslik: 'Şiir Dinletisi', saat: '16:00', yer: 'Bahçe Amfi', aciklama: 'Üyelerin yazdığı şiirlerin okunması.' },
    { baslik: 'Tarih Belgeseli İzleme', saat: '15:00', yer: 'Sinema Salonu', aciklama: 'Kitapla ilgili belgesel izleyip tartışacağız.' },
    { baslik: 'Kişisel Gelişim Workshop', saat: '14:00', yer: 'Seminer Odası 1', aciklama: 'Bu ayın kitabından çıkarımlar ve uygulamalar.' },
    { baslik: 'Manga Değerlendirmesi', saat: '18:30', yer: 'Çalışma Odası 5', aciklama: 'Son okuduğumuz manga serilerini değerlendiriyoruz.' },
    { baslik: 'Dünya Mutfağı & Edebiyat', saat: '12:00', yer: 'Kafeterya', aciklama: 'Okuduğumuz ülkenin yemeklerini deneyelim!' },
    { baslik: 'Startup Sunumları', saat: '19:30', yer: 'İnovasyon Merkezi', aciklama: 'Kitaptan ilham alan iş fikirlerini sunuyoruz.' },
    { baslik: 'Fantastik Film Gecesi', saat: '20:00', yer: 'Sinema Salonu', aciklama: 'Okuduğumuz kitabın film uyarlamasını izliyoruz.' },
    { baslik: 'Doğa Yürüyüşü & Okuma', saat: '10:00', yer: 'Kampüs Parkı', aciklama: 'Açık havada birlikte okuma etkinliği.' },
  ];

  const futureDate = (daysAhead) => {
    const d = new Date(); d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  };
  const pastDate = (daysAgo) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  clubIds.forEach((cid, i) => {
    const m = meetingData[i];
    insertMeeting.run(cid, m.baslik, futureDate(7 + i * 3), m.saat, m.yer, m.aciklama);
    if (i < 6) {
      insertMeeting.run(cid, 'Geçmiş Buluşma', pastDate(10 + i * 2), '17:00', 'Kütüphane', 'Tamamlanan toplantı.');
      db.prepare("UPDATE club_meetings SET durum = 'tamamlandi' WHERE club_id = ? AND baslik = 'Geçmiş Buluşma'").run(cid);
    }
  });

  const discussions = [
    { baslik: 'Hoş geldiniz!', mesaj: 'Kulübe hoş geldiniz! Kendinizi tanıtın ve en sevdiğiniz kitabı paylaşın.' },
    { baslik: 'Bu ayın kitabı hakkında', mesaj: 'Bu ayın kitabını okumaya başladınız mı? İlk izlenimleriniz neler?' },
    { baslik: 'Öneri kutusu', mesaj: 'Gelecek ay için kitap önerilerinizi buraya yazabilirsiniz.' },
    { baslik: 'Favori alıntılar', mesaj: 'Okuduğunuz kitaplardan en çok beğendiğiniz alıntıları paylaşalım.' },
  ];

  const replies = [
    'Merhaba! Katıldığıma çok sevindim. Benim favorim "Suç ve Ceza".',
    'Harika bir seçim olmuş, okumaya başladım bile!',
    'Ben de katılıyorum, bu kulüp tam bana göre.',
    'Geçen ayın kitabı muhteşemdi, bu ay da güzel olacak eminim.',
  ];

  clubIds.forEach((cid, i) => {
    const d1 = discussions[i % discussions.length];
    const r1 = insertDiscussion.run(cid, clubs[i].kurucu, d1.baslik, d1.mesaj, null);
    const otherUser = clubs[i].kurucu === admin.id ? ogrenci.id : admin.id;
    insertDiscussion.run(cid, otherUser, null, replies[i % replies.length], r1.lastInsertRowid);

    if (i < 8) {
      const d2 = discussions[(i + 1) % discussions.length];
      const r2 = insertDiscussion.run(cid, otherUser, d2.baslik, d2.mesaj, null);
      insertDiscussion.run(cid, clubs[i].kurucu, null, replies[(i + 2) % replies.length], r2.lastInsertRowid);
    }
  });
}

function enrichClub(db, club, userId) {
  const members = db.prepare(`
    SELECT cm.*, u.ad, u.soyad, u.username, u.okul_no
    FROM club_members cm JOIN users u ON cm.user_id = u.id
    WHERE cm.club_id = ? ORDER BY cm.katilim_tarihi
  `).all(club.id);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBook = db.prepare(`
    SELECT mb.*, b.ad as kitap_adi, b.yazar, b.kategori, b.isbn,
           u.ad as secen_ad, u.soyad as secen_soyad
    FROM club_monthly_books mb
    JOIN books b ON mb.book_id = b.id
    LEFT JOIN users u ON mb.secen_id = u.id
    WHERE mb.club_id = ? AND mb.ay = ?
  `).get(club.id, currentMonth);

  const meetings = db.prepare(`
    SELECT * FROM club_meetings WHERE club_id = ? ORDER BY tarih DESC LIMIT 10
  `).all(club.id);

  const kurucu = db.prepare(`
    SELECT u.ad, u.soyad, u.username FROM club_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.club_id = ? AND cm.rol = 'kurucu' LIMIT 1
  `).get(club.id);

  const myMembership = userId
    ? members.find((m) => m.user_id === userId) || null
    : null;

  return {
    ...club,
    kurucu,
    uye_sayisi: members.length,
    uyeler: members,
    aylik_kitap: monthlyBook || null,
    toplantilar: meetings,
    benim_uyeligim: myMembership,
  };
}

function listClubs(db, { durum, search, userId } = {}) {
  let sql = 'SELECT * FROM clubs WHERE 1=1';
  const params = [];
  if (durum) { sql += ' AND durum = ?'; params.push(durum); }
  if (search) { sql += ' AND (ad LIKE ? OR aciklama LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  const clubs = db.prepare(sql).all(...params);
  return clubs.map((c) => enrichClub(db, c, userId));
}

function getClub(db, id, userId) {
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(id);
  if (!club) return null;
  return enrichClub(db, club, userId);
}

function createClub(db, data, userId) {
  const { ad, aciklama, kapak_resmi, max_uye } = data;
  if (!ad || !ad.trim()) return { error: 'Kulüp adı zorunludur' };
  const existing = db.prepare('SELECT id FROM clubs WHERE ad = ?').get(ad.trim());
  if (existing) return { error: 'Bu isimde bir kulüp zaten var' };

  const result = db.prepare(`
    INSERT INTO clubs (ad, aciklama, kapak_resmi, kurucu_id, max_uye)
    VALUES (?, ?, ?, ?, ?)
  `).run(ad.trim(), aciklama || null, kapak_resmi || null, userId, max_uye || 50);

  db.prepare(`
    INSERT INTO club_members (club_id, user_id, rol) VALUES (?, ?, 'kurucu')
  `).run(result.lastInsertRowid, userId);

  return getClub(db, result.lastInsertRowid, userId);
}

function updateClub(db, id, data, userId) {
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(id);
  if (!club) return { error: 'Kulüp bulunamadı', status: 404 };

  const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(id, userId);
  const isAdmin = membership?.rol === 'kurucu' || membership?.rol === 'moderator';
  if (!isAdmin) return { error: 'Bu işlem için yetkiniz yok', status: 403 };

  const { ad, aciklama, kapak_resmi, max_uye, durum } = data;
  db.prepare(`
    UPDATE clubs SET ad = COALESCE(?, ad), aciklama = COALESCE(?, aciklama),
    kapak_resmi = COALESCE(?, kapak_resmi), max_uye = COALESCE(?, max_uye),
    durum = COALESCE(?, durum) WHERE id = ?
  `).run(ad || null, aciklama !== undefined ? aciklama : null, kapak_resmi !== undefined ? kapak_resmi : null, max_uye || null, durum || null, id);

  return getClub(db, id, userId);
}

function joinClub(db, clubId, userId) {
  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId);
  if (!club) return { error: 'Kulüp bulunamadı', status: 404 };
  if (club.durum !== 'aktif') return { error: 'Bu kulüp aktif değil' };

  const existing = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
  if (existing) return { error: 'Zaten bu kulübün üyesisiniz' };

  const count = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id = ?').get(clubId).c;
  if (count >= club.max_uye) return { error: 'Kulüp üye kapasitesi dolu' };

  db.prepare('INSERT INTO club_members (club_id, user_id, rol) VALUES (?, ?, ?)').run(clubId, userId, 'uye');
  return { message: 'Kulübe katıldınız', club: getClub(db, clubId, userId) };
}

function leaveClub(db, clubId, userId) {
  const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
  if (!membership) return { error: 'Bu kulübün üyesi değilsiniz' };
  if (membership.rol === 'kurucu') return { error: 'Kurucu kulüpten ayrılamaz' };

  db.prepare('DELETE FROM club_members WHERE club_id = ? AND user_id = ?').run(clubId, userId);
  return { message: 'Kulüpten ayrıldınız' };
}

function setMonthlyBook(db, clubId, bookId, userId, notlar) {
  const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
  if (!membership || (membership.rol !== 'kurucu' && membership.rol !== 'moderator')) {
    return { error: 'Bu işlem için yetkiniz yok', status: 403 };
  }
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: 'Kitap bulunamadı', status: 404 };

  const ay = new Date().toISOString().slice(0, 7);
  const existing = db.prepare('SELECT id FROM club_monthly_books WHERE club_id = ? AND ay = ?').get(clubId, ay);
  if (existing) {
    db.prepare('UPDATE club_monthly_books SET book_id = ?, secen_id = ?, notlar = ? WHERE id = ?').run(bookId, userId, notlar || null, existing.id);
  } else {
    db.prepare('INSERT INTO club_monthly_books (club_id, book_id, ay, secen_id, notlar) VALUES (?, ?, ?, ?, ?)').run(clubId, bookId, ay, userId, notlar || null);
  }
  return { message: 'Aylık kitap seçildi' };
}

function getMonthlyBooks(db, clubId) {
  return db.prepare(`
    SELECT mb.*, b.ad as kitap_adi, b.yazar, b.kategori,
           u.ad as secen_ad, u.soyad as secen_soyad
    FROM club_monthly_books mb
    JOIN books b ON mb.book_id = b.id
    LEFT JOIN users u ON mb.secen_id = u.id
    WHERE mb.club_id = ? ORDER BY mb.ay DESC
  `).all(clubId);
}

function createMeeting(db, clubId, data, userId) {
  const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
  if (!membership || (membership.rol !== 'kurucu' && membership.rol !== 'moderator')) {
    return { error: 'Bu işlem için yetkiniz yok', status: 403 };
  }
  const { baslik, tarih, saat, yer, aciklama } = data;
  if (!baslik || !tarih) return { error: 'Başlık ve tarih zorunludur' };

  const result = db.prepare(`
    INSERT INTO club_meetings (club_id, baslik, tarih, saat, yer, aciklama)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(clubId, baslik, tarih, saat || null, yer || null, aciklama || null);
  return db.prepare('SELECT * FROM club_meetings WHERE id = ?').get(result.lastInsertRowid);
}

function updateMeeting(db, meetingId, data, userId) {
  const meeting = db.prepare('SELECT * FROM club_meetings WHERE id = ?').get(meetingId);
  if (!meeting) return { error: 'Toplantı bulunamadı', status: 404 };

  const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(meeting.club_id, userId);
  if (!membership || (membership.rol !== 'kurucu' && membership.rol !== 'moderator')) {
    return { error: 'Bu işlem için yetkiniz yok', status: 403 };
  }
  const { baslik, tarih, saat, yer, aciklama, durum } = data;
  db.prepare(`
    UPDATE club_meetings SET baslik = COALESCE(?, baslik), tarih = COALESCE(?, tarih),
    saat = COALESCE(?, saat), yer = COALESCE(?, yer), aciklama = COALESCE(?, aciklama),
    durum = COALESCE(?, durum) WHERE id = ?
  `).run(baslik || null, tarih || null, saat || null, yer !== undefined ? yer : null, aciklama !== undefined ? aciklama : null, durum || null, meetingId);
  return db.prepare('SELECT * FROM club_meetings WHERE id = ?').get(meetingId);
}

function getDiscussions(db, clubId, limit = 50) {
  const posts = db.prepare(`
    SELECT d.*, u.ad as yazar_ad, u.soyad as yazar_soyad, u.username,
           cm.rol as yazar_rol
    FROM club_discussions d
    JOIN users u ON d.user_id = u.id
    LEFT JOIN club_members cm ON cm.club_id = d.club_id AND cm.user_id = d.user_id
    WHERE d.club_id = ?
    ORDER BY d.created_at DESC LIMIT ?
  `).all(clubId, limit);

  const threads = posts.filter((p) => !p.parent_id);
  return threads.map((t) => ({
    ...t,
    replies: posts.filter((p) => p.parent_id === t.id).reverse(),
  }));
}

function addDiscussion(db, clubId, userId, { baslik, mesaj, parent_id }) {
  const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
  if (!membership) return { error: 'Bu kulübün üyesi değilsiniz' };
  if (!mesaj || !mesaj.trim()) return { error: 'Mesaj boş olamaz' };

  const result = db.prepare(`
    INSERT INTO club_discussions (club_id, user_id, baslik, mesaj, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(clubId, userId, baslik || null, mesaj.trim(), parent_id || null);
  return db.prepare(`
    SELECT d.*, u.ad as yazar_ad, u.soyad as yazar_soyad, u.username
    FROM club_discussions d JOIN users u ON d.user_id = u.id WHERE d.id = ?
  `).get(result.lastInsertRowid);
}

function deleteDiscussion(db, postId, userId) {
  const post = db.prepare('SELECT * FROM club_discussions WHERE id = ?').get(postId);
  if (!post) return { error: 'Mesaj bulunamadı', status: 404 };
  if (post.user_id !== userId) {
    const membership = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(post.club_id, userId);
    if (!membership || (membership.rol !== 'kurucu' && membership.rol !== 'moderator')) {
      return { error: 'Bu işlem için yetkiniz yok', status: 403 };
    }
  }
  db.prepare('DELETE FROM club_discussions WHERE parent_id = ?').run(postId);
  db.prepare('DELETE FROM club_discussions WHERE id = ?').run(postId);
  return { message: 'Mesaj silindi' };
}

function getClubStats(db) {
  return {
    toplam: db.prepare('SELECT COUNT(*) as c FROM clubs').get().c,
    aktif: db.prepare("SELECT COUNT(*) as c FROM clubs WHERE durum = 'aktif'").get().c,
    toplam_uye: db.prepare('SELECT COUNT(*) as c FROM club_members').get().c,
    toplam_tartisma: db.prepare('SELECT COUNT(*) as c FROM club_discussions').get().c,
  };
}

module.exports = {
  migrateClubsSchema,
  seedClubsDemo,
  listClubs,
  getClub,
  createClub,
  updateClub,
  joinClub,
  leaveClub,
  setMonthlyBook,
  getMonthlyBooks,
  createMeeting,
  updateMeeting,
  getDiscussions,
  addDiscussion,
  deleteDiscussion,
  getClubStats,
};
