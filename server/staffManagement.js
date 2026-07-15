const bcrypt = require('bcryptjs');

const GOREVLER = {
  mudur: 'Kütüphane Müdürü',
  kutuphaneci: 'Kütüphaneci',
  asistan: 'Kütüphane Asistanı',
  teknik: 'Teknik Personel',
  guvenlik: 'Güvenlik',
};

const VARDIYALAR = {
  sabah: 'Sabah (08:00–16:00)',
  ogleden_sonra: 'Öğleden sonra (12:00–20:00)',
  aksam: 'Akşam (14:00–22:00)',
  tam_gun: 'Tam gün',
  esnek: 'Esnek',
};

const YETKI_SEVIYELERI = {
  sinirli: 'Sınırlı',
  standart: 'Standart',
  genis: 'Geniş',
  yonetici: 'Yönetici',
};

const IZIN_DURUMLARI = {
  calisiyor: 'Çalışıyor',
  izinli: 'İzinli',
  raporlu: 'Raporlu',
  uretimizni: 'Ücretsiz izin',
};

const TASK_STATUSES = {
  bekliyor: 'Bekliyor',
  devam: 'Devam ediyor',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal',
};

function migrateStaffSchema(db) {
  const alters = [
    'ALTER TABLE users ADD COLUMN sicil_no TEXT',
    'ALTER TABLE users ADD COLUMN gorev TEXT',
    'ALTER TABLE users ADD COLUMN vardiya TEXT',
    'ALTER TABLE users ADD COLUMN yetki_seviyesi TEXT',
    'ALTER TABLE users ADD COLUMN izin_durumu TEXT DEFAULT \'calisiyor\'',
    'ALTER TABLE users ADD COLUMN son_giris_tarihi DATETIME',
  ];
  alters.forEach((sql) => {
    try { db.exec(sql); } catch (_) { /* exists */ }
  });

  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baslik TEXT NOT NULL,
      aciklama TEXT,
      assigned_to INTEGER NOT NULL,
      assigned_by INTEGER NOT NULL,
      branch_id INTEGER,
      durum TEXT DEFAULT 'bekliyor'
        CHECK(durum IN ('bekliyor', 'devam', 'tamamlandi', 'iptal')),
      son_tarih TEXT,
      oncelik TEXT DEFAULT 'normal' CHECK(oncelik IN ('dusuk', 'normal', 'yuksek')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id),
      FOREIGN KEY (branch_id) REFERENCES library_branches(id)
    )
  `);
}

function getStaffMeta() {
  return {
    gorevler: Object.entries(GOREVLER).map(([id, ad]) => ({ id, ad })),
    vardiyalar: Object.entries(VARDIYALAR).map(([id, ad]) => ({ id, ad })),
    yetki_seviyeleri: Object.entries(YETKI_SEVIYELERI).map(([id, ad]) => ({ id, ad })),
    izin_durumlari: Object.entries(IZIN_DURUMLARI).map(([id, ad]) => ({ id, ad })),
    task_durumlari: Object.entries(TASK_STATUSES).map(([id, ad]) => ({ id, ad })),
  };
}

function enrichStaff(db, row) {
  const branch = row.branch_id
    ? db.prepare('SELECT id, kod, ad FROM library_branches WHERE id = ?').get(row.branch_id)
    : null;
  const aktifGorev = db.prepare(`
    SELECT COUNT(*) as c FROM staff_tasks
    WHERE assigned_to = ? AND durum IN ('bekliyor', 'devam')
  `).get(row.id).c;

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    ad: row.ad,
    soyad: row.soyad,
    email: row.email,
    telefon: row.telefon,
    sicil_no: row.sicil_no,
    gorev: row.gorev,
    gorev_adi: GOREVLER[row.gorev] || row.gorev || '—',
    branch_id: row.branch_id,
    sube: branch,
    vardiya: row.vardiya,
    vardiya_adi: VARDIYALAR[row.vardiya] || row.vardiya || '—',
    yetki_seviyesi: row.yetki_seviyesi,
    yetki_adi: YETKI_SEVIYELERI[row.yetki_seviyesi] || row.yetki_seviyesi || '—',
    izin_durumu: row.izin_durumu || 'calisiyor',
    izin_adi: IZIN_DURUMLARI[row.izin_durumu] || IZIN_DURUMLARI.calisiyor,
    son_giris_tarihi: row.son_giris_tarihi,
    created_at: row.created_at,
    aktif_gorev_sayisi: aktifGorev,
  };
}

function listStaff(db, { role } = {}) {
  let sql = `
    SELECT id, username, role, ad, soyad, email, telefon, sicil_no, gorev, branch_id,
           vardiya, yetki_seviyesi, izin_durumu, son_giris_tarihi, created_at
    FROM users
    WHERE role IN ('librarian', 'admin')
  `;
  const params = [];
  if (role === 'librarian' || role === 'admin') {
    sql += ' AND role = ?';
    params.push(role);
  }
  sql += ' ORDER BY role, ad, soyad';
  return db.prepare(sql).all(...params).map((r) => enrichStaff(db, r));
}

function getStaffById(db, id) {
  const row = db.prepare(`
    SELECT id, username, role, ad, soyad, email, telefon, sicil_no, gorev, branch_id,
           vardiya, yetki_seviyesi, izin_durumu, son_giris_tarihi, created_at
    FROM users WHERE id = ? AND role IN ('librarian', 'admin')
  `).get(id);
  return row ? enrichStaff(db, row) : null;
}

function createStaff(db, data) {
  const username = (data.username || '').trim();
  const password = data.password || '';
  const ad = (data.ad || '').trim();
  const soyad = (data.soyad || '').trim();
  const role = data.role === 'admin' ? 'admin' : 'librarian';

  if (!username || !password || !ad || !soyad) {
    return { error: 'Kullanıcı adı, şifre, ad ve soyad zorunludur', status: 400 };
  }
  if (password.length < 6) {
    return { error: 'Şifre en az 6 karakter olmalıdır', status: 400 };
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return { error: 'Bu kullanıcı adı zaten mevcut', status: 400 };

  const sicil = (data.sicil_no || '').trim() || null;
  if (sicil) {
    const sicilExists = db.prepare('SELECT id FROM users WHERE sicil_no = ?').get(sicil);
    if (sicilExists) return { error: 'Bu sicil numarası zaten kayıtlı', status: 400 };
  }

  const gorev = GOREVLER[data.gorev] ? data.gorev : (role === 'admin' ? 'mudur' : 'kutuphaneci');
  const vardiya = VARDIYALAR[data.vardiya] ? data.vardiya : 'tam_gun';
  const yetki = YETKI_SEVIYELERI[data.yetki_seviyesi]
    ? data.yetki_seviyesi
    : (role === 'admin' ? 'yonetici' : 'standart');
  const izin = IZIN_DURUMLARI[data.izin_durumu] ? data.izin_durumu : 'calisiyor';
  const branchId = data.branch_id ? parseInt(data.branch_id, 10) : null;
  const hash = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO users (
      username, password, role, ad, soyad, email, telefon,
      sicil_no, gorev, branch_id, vardiya, yetki_seviyesi, izin_durumu
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    username, hash, role, ad, soyad,
    (data.email || '').trim() || null,
    (data.telefon || '').trim() || null,
    sicil, gorev, branchId, vardiya, yetki, izin,
  );

  return {
    staff: getStaffById(db, result.lastInsertRowid),
    message: 'Personel kaydı oluşturuldu',
  };
}

function updateStaff(db, id, data) {
  const row = db.prepare('SELECT * FROM users WHERE id = ? AND role IN (\'librarian\', \'admin\')').get(id);
  if (!row) return { error: 'Personel bulunamadı', status: 404 };

  if (data.sicil_no !== undefined) {
    const sicil = (data.sicil_no || '').trim() || null;
    if (sicil) {
      const clash = db.prepare('SELECT id FROM users WHERE sicil_no = ? AND id != ?').get(sicil, id);
      if (clash) return { error: 'Bu sicil numarası zaten kayıtlı', status: 400 };
    }
  }

  const gorev = data.gorev !== undefined
    ? (GOREVLER[data.gorev] ? data.gorev : row.gorev)
    : row.gorev;
  const vardiya = data.vardiya !== undefined
    ? (VARDIYALAR[data.vardiya] ? data.vardiya : row.vardiya)
    : row.vardiya;
  const yetki = data.yetki_seviyesi !== undefined
    ? (YETKI_SEVIYELERI[data.yetki_seviyesi] ? data.yetki_seviyesi : row.yetki_seviyesi)
    : row.yetki_seviyesi;
  const izin = data.izin_durumu !== undefined
    ? (IZIN_DURUMLARI[data.izin_durumu] ? data.izin_durumu : row.izin_durumu)
    : row.izin_durumu;
  const branchId = data.branch_id !== undefined
    ? (data.branch_id ? parseInt(data.branch_id, 10) : null)
    : row.branch_id;

  db.prepare(`
    UPDATE users SET
      ad = COALESCE(?, ad),
      soyad = COALESCE(?, soyad),
      email = COALESCE(?, email),
      telefon = COALESCE(?, telefon),
      sicil_no = ?,
      gorev = ?,
      branch_id = ?,
      vardiya = ?,
      yetki_seviyesi = ?,
      izin_durumu = ?
    WHERE id = ?
  `).run(
    (data.ad || '').trim() || null,
    (data.soyad || '').trim() || null,
    data.email !== undefined ? ((data.email || '').trim() || null) : row.email,
    data.telefon !== undefined ? ((data.telefon || '').trim() || null) : row.telefon,
    data.sicil_no !== undefined ? ((data.sicil_no || '').trim() || null) : row.sicil_no,
    gorev,
    branchId,
    vardiya,
    yetki,
    izin || 'calisiyor',
    id,
  );

  if (data.password && data.password.length >= 6) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?')
      .run(bcrypt.hashSync(data.password, 10), id);
  }

  return { staff: getStaffById(db, id), message: 'Personel güncellendi' };
}

function touchLastLogin(db, userId) {
  db.prepare('UPDATE users SET son_giris_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

function enrichTask(db, row) {
  const assignee = db.prepare('SELECT ad, soyad, username FROM users WHERE id = ?').get(row.assigned_to);
  const assigner = db.prepare('SELECT ad, soyad FROM users WHERE id = ?').get(row.assigned_by);
  const branch = row.branch_id
    ? db.prepare('SELECT id, ad FROM library_branches WHERE id = ?').get(row.branch_id)
    : null;
  return {
    ...row,
    durum_adi: TASK_STATUSES[row.durum] || row.durum,
    atanan: assignee ? `${assignee.ad} ${assignee.soyad}` : null,
    atanan_username: assignee?.username,
    atayan: assigner ? `${assigner.ad} ${assigner.soyad}` : null,
    sube: branch,
  };
}

function listTasks(db, { assigned_to, durum } = {}) {
  let sql = 'SELECT * FROM staff_tasks WHERE 1=1';
  const params = [];
  if (assigned_to) {
    sql += ' AND assigned_to = ?';
    params.push(assigned_to);
  }
  if (durum && TASK_STATUSES[durum]) {
    sql += ' AND durum = ?';
    params.push(durum);
  }
  sql += ` ORDER BY CASE durum
    WHEN 'bekliyor' THEN 0 WHEN 'devam' THEN 1 WHEN 'tamamlandi' THEN 2 ELSE 3 END,
    CASE oncelik WHEN 'yuksek' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    created_at DESC`;
  return db.prepare(sql).all(...params).map((r) => enrichTask(db, r));
}

function createTask(db, assignerId, data) {
  const baslik = (data.baslik || '').trim();
  const assignedTo = parseInt(data.assigned_to, 10);
  if (!baslik) return { error: 'Görev başlığı zorunludur', status: 400 };
  if (!assignedTo) return { error: 'Personel seçilmelidir', status: 400 };

  const staff = db.prepare(`
    SELECT id FROM users WHERE id = ? AND role IN ('librarian', 'admin')
  `).get(assignedTo);
  if (!staff) return { error: 'Atanan personel bulunamadı', status: 404 };

  const result = db.prepare(`
    INSERT INTO staff_tasks (baslik, aciklama, assigned_to, assigned_by, branch_id, durum, son_tarih, oncelik)
    VALUES (?, ?, ?, ?, ?, 'bekliyor', ?, ?)
  `).run(
    baslik,
    (data.aciklama || '').trim() || null,
    assignedTo,
    assignerId,
    data.branch_id ? parseInt(data.branch_id, 10) : null,
    (data.son_tarih || '').trim() || null,
    ['dusuk', 'normal', 'yuksek'].includes(data.oncelik) ? data.oncelik : 'normal',
  );

  try {
    const { sendNotification } = require('./notificationCenter');
    sendNotification(db, assignedTo, 'sistem_duyurusu', {
      baslik: 'Yeni görev atandı',
      mesaj: `"${baslik}" görevi size atandı.`,
      link: '/kutuphaneci',
      oncelik: data.oncelik === 'yuksek' ? 'yuksek' : 'normal',
    });
  } catch (_) { /* ignore */ }

  const task = enrichTask(db, db.prepare('SELECT * FROM staff_tasks WHERE id = ?').get(result.lastInsertRowid));
  return { task, message: 'Görev atandı' };
}

function updateTaskStatus(db, id, data, actor) {
  const row = db.prepare('SELECT * FROM staff_tasks WHERE id = ?').get(id);
  if (!row) return { error: 'Görev bulunamadı', status: 404 };

  const isAdmin = actor.role === 'admin';
  const isAssignee = Number(row.assigned_to) === Number(actor.id);
  if (!isAdmin && !isAssignee) {
    return { error: 'Bu görevi güncelleme yetkiniz yok', status: 403 };
  }

  let durum = row.durum;
  if (data.durum && TASK_STATUSES[data.durum]) {
    durum = data.durum;
  }

  db.prepare(`
    UPDATE staff_tasks SET
      durum = ?,
      aciklama = COALESCE(?, aciklama),
      son_tarih = COALESCE(?, son_tarih),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    durum,
    data.aciklama !== undefined ? ((data.aciklama || '').trim() || null) : null,
    data.son_tarih !== undefined ? ((data.son_tarih || '').trim() || null) : null,
    id,
  );

  return {
    task: enrichTask(db, db.prepare('SELECT * FROM staff_tasks WHERE id = ?').get(id)),
    message: 'Görev güncellendi',
  };
}

function seedStaffDemo(db) {
  migrateStaffSchema(db);

  const kutuphaneci = db.prepare("SELECT id FROM users WHERE username = 'kutuphaneci'").get();
  if (kutuphaneci) {
    const row = db.prepare('SELECT sicil_no FROM users WHERE id = ?').get(kutuphaneci.id);
    if (!row.sicil_no) {
      const merkez = db.prepare("SELECT id FROM library_branches WHERE kod = 'MERKEZ'").get();
      db.prepare(`
        UPDATE users SET
          sicil_no = COALESCE(sicil_no, 'P-1001'),
          gorev = COALESCE(gorev, 'kutuphaneci'),
          vardiya = COALESCE(vardiya, 'tam_gun'),
          yetki_seviyesi = COALESCE(yetki_seviyesi, 'standart'),
          izin_durumu = COALESCE(izin_durumu, 'calisiyor'),
          branch_id = COALESCE(branch_id, ?)
        WHERE id = ?
      `).run(merkez?.id || null, kutuphaneci.id);
    }
  }

  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (admin) {
    db.prepare(`
      UPDATE users SET
        sicil_no = COALESCE(sicil_no, 'P-0001'),
        gorev = COALESCE(gorev, 'mudur'),
        vardiya = COALESCE(vardiya, 'tam_gun'),
        yetki_seviyesi = COALESCE(yetki_seviyesi, 'yonetici'),
        izin_durumu = COALESCE(izin_durumu, 'calisiyor')
      WHERE id = ?
    `).run(admin.id);
  }

  const taskCount = db.prepare('SELECT COUNT(*) as c FROM staff_tasks').get().c;
  if (taskCount === 0 && kutuphaneci && admin) {
    db.prepare(`
      INSERT INTO staff_tasks (baslik, aciklama, assigned_to, assigned_by, durum, son_tarih, oncelik)
      VALUES (?, ?, ?, ?, 'bekliyor', date('now', '+7 days'), 'normal')
    `).run(
      'A bloğu raf düzenlemesi',
      'A-01 ve A-02 raflarını kontrol edip eksikleri envanter sayımına bildir.',
      kutuphaneci.id,
      admin.id,
    );
  }
}

module.exports = {
  GOREVLER,
  VARDIYALAR,
  YETKI_SEVIYELERI,
  IZIN_DURUMLARI,
  TASK_STATUSES,
  migrateStaffSchema,
  getStaffMeta,
  listStaff,
  getStaffById,
  createStaff,
  updateStaff,
  touchLastLogin,
  listTasks,
  createTask,
  updateTaskStatus,
  seedStaffDemo,
};
