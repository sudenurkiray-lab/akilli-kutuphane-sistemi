const { findCopyByCode } = require('./scan');

const SESSION_STATUSES = {
  aktif: { ad: 'Aktif', renk: 'green' },
  tamamlandi: { ad: 'Tamamlandı', renk: 'purple' },
  iptal: { ad: 'İptal', renk: 'red' },
};

const SCAN_RESULTS = {
  bulundu: { ad: 'Bulundu', renk: 'green' },
  yanlis_raf: { ad: 'Yanlış raf', renk: 'yellow' },
  beklenmeyen: { ad: 'Beklenmeyen / kapsam dışı', renk: 'orange' },
};

function migrateInventorySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER,
      expected_raf_no TEXT,
      durum TEXT DEFAULT 'aktif' CHECK(durum IN ('aktif', 'tamamlandi', 'iptal')),
      notlar TEXT,
      started_by INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (branch_id) REFERENCES library_branches(id),
      FOREIGN KEY (started_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_expected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      copy_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      expected_raf_no TEXT,
      barkod TEXT,
      kitap_adi TEXT,
      yazar TEXT,
      UNIQUE(session_id, copy_id),
      FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      FOREIGN KEY (copy_id) REFERENCES book_copies(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      copy_id INTEGER,
      scanned_code TEXT NOT NULL,
      sonuc TEXT NOT NULL CHECK(sonuc IN ('bulundu', 'yanlis_raf', 'beklenmeyen')),
      expected_raf_no TEXT,
      actual_raf_no TEXT,
      fiziksel_durum TEXT,
      kitap_adi TEXT,
      barkod TEXT,
      scanned_by INTEGER,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      FOREIGN KEY (copy_id) REFERENCES book_copies(id),
      FOREIGN KEY (scanned_by) REFERENCES users(id)
    );
  `);
}

function getDistinctRafs(db, branchId) {
  let sql = `
    SELECT DISTINCT raf_no FROM book_copies
    WHERE raf_no IS NOT NULL AND raf_no != '' AND fiziksel_durum = 'rafta'
  `;
  const params = [];
  if (branchId) {
    sql += ' AND branch_id = ?';
    params.push(branchId);
  }
  sql += ' ORDER BY raf_no';
  return db.prepare(sql).all(...params).map((r) => r.raf_no);
}

function buildExpectedQuery(branchId, rafNo) {
  let sql = `
    SELECT c.id as copy_id, c.book_id, c.raf_no, c.barkod, c.fiziksel_durum,
           b.ad as kitap_adi, b.yazar
    FROM book_copies c
    JOIN books b ON c.book_id = b.id
    WHERE c.fiziksel_durum = 'rafta'
  `;
  const params = [];
  if (branchId) {
    sql += ' AND c.branch_id = ?';
    params.push(branchId);
  }
  if (rafNo) {
    sql += ' AND c.raf_no = ?';
    params.push(rafNo);
  }
  sql += ' ORDER BY c.raf_no, b.ad, c.kopya_no';
  return { sql, params };
}

function createSession(db, user, data = {}) {
  let branchId = data.branch_id ? parseInt(data.branch_id, 10) : null;
  if (user.role === 'librarian') {
    branchId = user.branch_id || branchId;
    if (!branchId) return { error: 'Kütüphaneci hesabına şube atanmamış', status: 400 };
  }
  const rafNo = (data.raf_no || '').trim() || null;
  const notlar = (data.notlar || '').trim() || null;

  const { sql, params } = buildExpectedQuery(branchId, rafNo);
  const expected = db.prepare(sql).all(...params);
  if (expected.length === 0) {
    return { error: 'Bu kapsamda rafta sayılacak kopya bulunamadı', status: 400 };
  }

  const result = db.prepare(`
    INSERT INTO inventory_sessions (branch_id, expected_raf_no, durum, notlar, started_by)
    VALUES (?, ?, 'aktif', ?, ?)
  `).run(branchId, rafNo, notlar, user.id);

  const sessionId = result.lastInsertRowid;
  const insert = db.prepare(`
    INSERT INTO inventory_expected (session_id, copy_id, book_id, expected_raf_no, barkod, kitap_adi, yazar)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((rows) => {
    rows.forEach((r) => {
      insert.run(sessionId, r.copy_id, r.book_id, r.raf_no, r.barkod, r.kitap_adi, r.yazar);
    });
  });
  tx(expected);

  return {
    session: getSessionDetail(db, sessionId),
    message: `Sayım başlatıldı — ${expected.length} kopya kapsamda`,
  };
}

function enrichSession(db, row) {
  const branch = row.branch_id
    ? db.prepare('SELECT id, ad, kod FROM library_branches WHERE id = ?').get(row.branch_id)
    : null;
  const starter = db.prepare('SELECT ad, soyad FROM users WHERE id = ?').get(row.started_by);
  const expectedCount = db.prepare('SELECT COUNT(*) as c FROM inventory_expected WHERE session_id = ?').get(row.id).c;
  const scanStats = db.prepare(`
    SELECT
      COUNT(*) as tarama,
      SUM(CASE WHEN sonuc = 'bulundu' THEN 1 ELSE 0 END) as bulundu,
      SUM(CASE WHEN sonuc = 'yanlis_raf' THEN 1 ELSE 0 END) as yanlis_raf,
      SUM(CASE WHEN sonuc = 'beklenmeyen' THEN 1 ELSE 0 END) as beklenmeyen
    FROM inventory_scans WHERE session_id = ?
  `).get(row.id);

  const scannedExpected = db.prepare(`
    SELECT COUNT(DISTINCT e.copy_id) as c
    FROM inventory_expected e
    JOIN inventory_scans s ON s.session_id = e.session_id AND s.copy_id = e.copy_id
      AND s.sonuc IN ('bulundu', 'yanlis_raf')
    WHERE e.session_id = ?
  `).get(row.id).c;

  const eksik = Math.max(0, expectedCount - scannedExpected);
  const tamamlanan = expectedCount > 0 ? Math.round((scannedExpected / expectedCount) * 100) : 0;

  return {
    ...row,
    durum_adi: SESSION_STATUSES[row.durum]?.ad || row.durum,
    sube: branch,
    baslatan: starter ? `${starter.ad} ${starter.soyad}` : null,
    kapsam: row.expected_raf_no ? `Raf: ${row.expected_raf_no}` : 'Tüm raflar',
    ozet: {
      beklenen: expectedCount,
      tarama: scanStats.tarama || 0,
      bulundu: scanStats.bulundu || 0,
      yanlis_raf: scanStats.yanlis_raf || 0,
      beklenmeyen: scanStats.beklenmeyen || 0,
      eksik,
      tamamlanan_yuzde: tamamlanan,
    },
  };
}

function listSessions(db, { branch_id, durum } = {}) {
  let sql = 'SELECT * FROM inventory_sessions WHERE 1=1';
  const params = [];
  if (branch_id) {
    sql += ' AND branch_id = ?';
    params.push(branch_id);
  }
  if (durum && SESSION_STATUSES[durum]) {
    sql += ' AND durum = ?';
    params.push(durum);
  }
  sql += ' ORDER BY started_at DESC LIMIT 50';
  return db.prepare(sql).all(...params).map((r) => enrichSession(db, r));
}

function getSessionDetail(db, id) {
  const row = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(id);
  if (!row) return null;
  return enrichSession(db, row);
}

function getSessionReport(db, id) {
  const session = getSessionDetail(db, id);
  if (!session) return { error: 'Sayım bulunamadı', status: 404 };

  const scannedCopyIds = new Set(
    db.prepare(`
      SELECT copy_id FROM inventory_scans
      WHERE session_id = ? AND copy_id IS NOT NULL AND sonuc IN ('bulundu', 'yanlis_raf')
    `).all(id).map((r) => r.copy_id),
  );

  const expected = db.prepare(`
    SELECT * FROM inventory_expected WHERE session_id = ? ORDER BY expected_raf_no, kitap_adi
  `).all(id);

  const bulunan = [];
  const eksik = [];
  expected.forEach((e) => {
    if (scannedCopyIds.has(e.copy_id)) bulunan.push(e);
    else eksik.push(e);
  });

  const yanlisRaf = db.prepare(`
    SELECT * FROM inventory_scans WHERE session_id = ? AND sonuc = 'yanlis_raf' ORDER BY scanned_at DESC
  `).all(id);

  const beklenmeyen = db.prepare(`
    SELECT * FROM inventory_scans WHERE session_id = ? AND sonuc = 'beklenmeyen' ORDER BY scanned_at DESC
  `).all(id);

  const taramalar = db.prepare(`
    SELECT * FROM inventory_scans WHERE session_id = ? ORDER BY scanned_at DESC LIMIT 200
  `).all(id);

  return {
    session,
    rapor: {
      ozet: session.ozet,
      beklenen_liste: expected,
      bulunan,
      eksik,
      yanlis_raf: yanlisRaf,
      beklenmeyen,
      taramalar,
      olusturma_tarihi: new Date().toISOString(),
    },
  };
}

function scanIntoSession(db, sessionId, code, user) {
  const session = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(sessionId);
  if (!session) return { error: 'Sayım bulunamadı', status: 404 };
  if (session.durum !== 'aktif') {
    return { error: 'Bu sayım aktif değil; tarama yapılamaz', status: 400 };
  }

  const raw = (code || '').trim();
  if (!raw) return { error: 'Barkod / QR kodu gerekli', status: 400 };

  const copy = findCopyByCode(db, raw);
  if (!copy) return { error: 'Kopya bulunamadı', status: 404 };

  if (session.branch_id && copy.branch_id && Number(copy.branch_id) !== Number(session.branch_id)) {
    const insert = db.prepare(`
      INSERT INTO inventory_scans
        (session_id, copy_id, scanned_code, sonuc, expected_raf_no, actual_raf_no, fiziksel_durum, kitap_adi, barkod, scanned_by)
      VALUES (?, ?, ?, 'beklenmeyen', ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, copy.id, raw, session.expected_raf_no, copy.raf_no, copy.fiziksel_durum,
      copy.kitap_adi, copy.barkod, user.id,
    );
    return {
      sonuc: 'beklenmeyen',
      sonuc_adi: SCAN_RESULTS.beklenmeyen.ad,
      message: `Farklı şube kopyası: ${copy.kitap_adi} (${copy.barkod})`,
      scan: db.prepare('SELECT * FROM inventory_scans WHERE id = ?').get(insert.lastInsertRowid),
      session: getSessionDetail(db, sessionId),
    };
  }

  const already = db.prepare(`
    SELECT id FROM inventory_scans WHERE session_id = ? AND copy_id = ? AND sonuc IN ('bulundu', 'yanlis_raf')
  `).get(sessionId, copy.id);
  if (already) {
    return {
      error: 'Bu kopya bu sayımda zaten tarandı',
      status: 400,
      session: getSessionDetail(db, sessionId),
    };
  }

  const expectedRow = db.prepare(`
    SELECT * FROM inventory_expected WHERE session_id = ? AND copy_id = ?
  `).get(sessionId, copy.id);

  let sonuc;
  let message;

  if (expectedRow) {
    if (session.expected_raf_no && copy.raf_no && copy.raf_no !== session.expected_raf_no) {
      sonuc = 'yanlis_raf';
      message = `Yanlış raf: ${copy.kitap_adi} — sayılan raf ${session.expected_raf_no}, kayıtlı raf ${copy.raf_no}`;
    } else {
      sonuc = 'bulundu';
      message = `Bulundu: ${copy.kitap_adi} (${copy.barkod}) — Raf ${copy.raf_no || '—'}`;
    }
  } else if (session.expected_raf_no && copy.raf_no && copy.raf_no !== session.expected_raf_no) {
    sonuc = 'yanlis_raf';
    message = `Yanlış rafta okutuldu: ${copy.kitap_adi} — kayıtlı raf ${copy.raf_no}, bu sayım ${session.expected_raf_no}`;
  } else {
    sonuc = 'beklenmeyen';
    const durum = copy.fiziksel_durum || '?';
    message = `Kapsam dışı (${durum}): ${copy.kitap_adi} (${copy.barkod})`;
  }

  const insert = db.prepare(`
    INSERT INTO inventory_scans
      (session_id, copy_id, scanned_code, sonuc, expected_raf_no, actual_raf_no, fiziksel_durum, kitap_adi, barkod, scanned_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    copy.id,
    raw,
    sonuc,
    expectedRow?.expected_raf_no || session.expected_raf_no,
    copy.raf_no,
    copy.fiziksel_durum,
    copy.kitap_adi,
    copy.barkod,
    user.id,
  );

  return {
    sonuc,
    sonuc_adi: SCAN_RESULTS[sonuc]?.ad || sonuc,
    message,
    copy: {
      id: copy.id,
      barkod: copy.barkod,
      kitap_adi: copy.kitap_adi,
      yazar: copy.yazar,
      raf_no: copy.raf_no,
      fiziksel_durum: copy.fiziksel_durum,
    },
    scan: db.prepare('SELECT * FROM inventory_scans WHERE id = ?').get(insert.lastInsertRowid),
    session: getSessionDetail(db, sessionId),
  };
}

function completeSession(db, id, userId) {
  const session = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(id);
  if (!session) return { error: 'Sayım bulunamadı', status: 404 };
  if (session.durum !== 'aktif') {
    return { error: 'Yalnızca aktif sayımlar tamamlanabilir', status: 400 };
  }
  db.prepare(`
    UPDATE inventory_sessions SET durum = 'tamamlandi', completed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
  return {
    session: getSessionDetail(db, id),
    report: getSessionReport(db, id),
    message: 'Sayım tamamlandı — rapor hazır',
  };
}

function cancelSession(db, id) {
  const session = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(id);
  if (!session) return { error: 'Sayım bulunamadı', status: 404 };
  if (session.durum !== 'aktif') {
    return { error: 'Yalnızca aktif sayımlar iptal edilebilir', status: 400 };
  }
  db.prepare(`
    UPDATE inventory_sessions SET durum = 'iptal', completed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
  return { session: getSessionDetail(db, id), message: 'Sayım iptal edildi' };
}

function seedInventoryDemo(db) {
  migrateInventorySchema(db);
  // no forced demo sessions — keep empty until librarian starts
}

module.exports = {
  SESSION_STATUSES,
  SCAN_RESULTS,
  migrateInventorySchema,
  getDistinctRafs,
  createSession,
  listSessions,
  getSessionDetail,
  getSessionReport,
  scanIntoSession,
  completeSession,
  cancelSession,
  seedInventoryDemo,
};
