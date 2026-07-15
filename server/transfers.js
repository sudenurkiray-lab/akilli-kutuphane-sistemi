const RULES = require('./rules');
const { hasUnpaidPenalties } = require('./advancedPenalties');
const { syncBookStock } = require('./copies');
const { sendNotification } = require('./notificationCenter');

const LOAN_DAYS = RULES.LOAN_DAYS;

// Transfer sürecinin sıralı adımları
const TRANSFER_FLOW = [
  { durum: 'talep', label: 'Talep oluşturuldu', tarih_alani: 'talep_tarihi' },
  { durum: 'onaylandi', label: 'Onaylandı', tarih_alani: 'onay_tarihi' },
  { durum: 'hazirlaniyor', label: 'Hazırlanıyor', tarih_alani: 'hazirlik_tarihi' },
  { durum: 'transfer_edildi', label: 'Transfer edildi', tarih_alani: 'transfer_tarihi' },
  { durum: 'teslim_noktasinda', label: 'Teslim noktasına ulaştı', tarih_alani: 'teslim_noktasi_tarihi' },
  { durum: 'teslim_edildi', label: 'Kullanıcıya teslim edildi', tarih_alani: 'teslim_tarihi' },
];

const STATE_INDEX = Object.fromEntries(TRANSFER_FLOW.map((s, i) => [s.durum, i]));
const AKTIF_DURUMLAR = ['talep', 'onaylandi', 'hazirlaniyor', 'transfer_edildi', 'teslim_noktasinda'];
// Öğrencinin iptal edebileceği erken aşamalar
const IPTAL_EDILEBILIR = ['talep', 'onaylandi'];

function notify(db, userId, refId, baslik, mesaj) {
  sendNotification(db, userId, 'kitap_transfer', {
    refId,
    baslik,
    mesaj,
    link: '/uye/profil',
  });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function findSourceCopy(db, bookId, sourceBranchId) {
  return db.prepare(`
    SELECT * FROM book_copies
    WHERE book_id = ? AND branch_id = ? AND fiziksel_durum = 'rafta'
    ORDER BY kopya_no LIMIT 1
  `).get(bookId, sourceBranchId);
}

function releaseCopy(db, copyId) {
  if (!copyId) return;
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(copyId);
  if (copy && copy.fiziksel_durum === 'rezerve') {
    db.prepare("UPDATE book_copies SET fiziksel_durum = 'rafta' WHERE id = ?").run(copyId);
    syncBookStock(db, copy.book_id);
  }
}

function createTransfer(db, userId, bookId, kaynakSubeId, hedefSubeId) {
  const member = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'member'").get(userId);
  if (!member) return { error: 'Üye bulunamadı', status: 404 };
  if (member.uyelik_durumu !== 'aktif') return { error: 'Üyeliğiniz aktif değil', status: 400 };

  const activeLoans = db.prepare(`
    SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum IN ('aktif', 'gecikti')
  `).get(userId);
  if (activeLoans.c >= RULES.MAX_LOANS_PER_MEMBER) {
    return { error: `Maksimum ${RULES.MAX_LOANS_PER_MEMBER} kitap ödünç alınabilir`, status: 400 };
  }
  if (hasUnpaidPenalties(db, userId)) {
    return { error: 'Ödenmemiş ceza var, transfer talebi oluşturulamaz', status: 400 };
  }

  if (member.tercih_sube_id && Number(hedefSubeId) !== Number(member.tercih_sube_id)) {
    return { error: 'Transfer yalnızca kayıtlı teslim şubenize yapılabilir', status: 400 };
  }

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return { error: 'Kitap bulunamadı', status: 404 };

  const kaynak = db.prepare('SELECT * FROM library_branches WHERE id = ?').get(kaynakSubeId);
  const hedef = db.prepare('SELECT * FROM library_branches WHERE id = ?').get(hedefSubeId);
  if (!kaynak || !hedef) return { error: 'Şube bulunamadı', status: 404 };
  if (Number(kaynakSubeId) === Number(hedefSubeId)) {
    return { error: 'Kitap zaten bu şubede, transfere gerek yok', status: 400 };
  }

  const existing = db.prepare(`
    SELECT id FROM transfers
    WHERE user_id = ? AND book_id = ? AND durum IN ('talep','onaylandi','hazirlaniyor','transfer_edildi','teslim_noktasinda')
  `).get(userId, bookId);
  if (existing) return { error: 'Bu kitap için zaten aktif bir transfer talebiniz var', status: 400 };

  const copy = findSourceCopy(db, bookId, kaynakSubeId);
  if (!copy) return { error: 'Kaynak şubede müsait kopya bulunamadı', status: 400 };

  db.prepare("UPDATE book_copies SET fiziksel_durum = 'rezerve' WHERE id = ?").run(copy.id);
  syncBookStock(db, bookId);

  const result = db.prepare(`
    INSERT INTO transfers (user_id, book_id, copy_id, kaynak_sube_id, hedef_sube_id, durum)
    VALUES (?, ?, ?, ?, ?, 'talep')
  `).run(userId, bookId, copy.id, kaynakSubeId, hedefSubeId);

  notify(
    db, userId, result.lastInsertRowid,
    'Transfer talebi alındı',
    `"${book.ad}" kitabı için ${kaynak.ad} → ${hedef.ad} transfer talebiniz oluşturuldu. Onaylandığında bildirim alacaksınız.`,
  );

  return {
    status: 201,
    id: result.lastInsertRowid,
    message: 'Transfer talebi oluşturuldu',
  };
}

function deliverToUser(db, transfer) {
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(transfer.copy_id);
  if (!copy) return null;

  // Kopya artık hedef şubede ve öğrenciye ödünç verilir
  db.prepare("UPDATE book_copies SET branch_id = ?, sube = (SELECT ad FROM library_branches WHERE id = ?), fiziksel_durum = 'oduncte' WHERE id = ?")
    .run(transfer.hedef_sube_id, transfer.hedef_sube_id, copy.id);

  const teslim = addDays(new Date(), LOAN_DAYS);
  const loan = db.prepare(`
    INSERT INTO loans (user_id, book_id, copy_id, teslim_tarihi, durum) VALUES (?, ?, ?, ?, 'aktif')
  `).run(transfer.user_id, transfer.book_id, copy.id, teslim);

  syncBookStock(db, transfer.book_id);
  return { loanId: loan.lastInsertRowid, teslim };
}

function setTransferStatus(db, transferId, yeniDurum, actor) {
  const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(transferId);
  if (!transfer) return { error: 'Transfer bulunamadı', status: 404 };

  // Kütüphaneci yalnızca kendi şubesiyle ilgili transferleri yönetebilir
  if (actor?.role === 'librarian') {
    const row = db.prepare('SELECT branch_id FROM users WHERE id = ?').get(actor.id);
    const bid = row?.branch_id;
    if (bid && bid !== transfer.kaynak_sube_id && bid !== transfer.hedef_sube_id) {
      return { error: 'Bu transferi yönetme yetkiniz yok', status: 403 };
    }
  }

  if (!STATE_INDEX.hasOwnProperty(yeniDurum)) {
    return { error: 'Geçersiz durum', status: 400 };
  }
  if (!AKTIF_DURUMLAR.includes(transfer.durum) && transfer.durum !== 'teslim_noktasinda') {
    return { error: 'Bu transfer artık güncellenemez', status: 400 };
  }

  const currentIdx = STATE_INDEX[transfer.durum] ?? -1;
  const nextIdx = STATE_INDEX[yeniDurum];
  if (nextIdx !== currentIdx + 1) {
    return { error: 'Adımlar sırayla ilerlemelidir', status: 400 };
  }

  const book = db.prepare('SELECT ad FROM books WHERE id = ?').get(transfer.book_id);
  const hedef = db.prepare('SELECT ad FROM library_branches WHERE id = ?').get(transfer.hedef_sube_id);
  const tarihAlani = TRANSFER_FLOW[nextIdx].tarih_alani;

  db.prepare(`UPDATE transfers SET durum = ?, ${tarihAlani} = datetime('now') WHERE id = ?`)
    .run(yeniDurum, transferId);

  let extra = {};
  if (yeniDurum === 'teslim_edildi') {
    const delivered = deliverToUser(db, transfer);
    if (delivered) {
      db.prepare('UPDATE transfers SET loan_id = ? WHERE id = ?').run(delivered.loanId, transferId);
      extra.loan_id = delivered.loanId;
    }
  }

  const mesajlar = {
    onaylandi: `"${book.ad}" transfer talebiniz onaylandı, hazırlık başlıyor.`,
    hazirlaniyor: `"${book.ad}" kitabı kaynak şubede hazırlanıyor.`,
    transfer_edildi: `"${book.ad}" kitabı ${hedef.ad} şubesine yola çıktı.`,
    teslim_noktasinda: `"${book.ad}" kitabı ${hedef.ad} teslim noktasına ulaştı.`,
    teslim_edildi: `"${book.ad}" kitabı size teslim edildi ve ödünç kaydınız oluşturuldu. İyi okumalar!`,
  };
  if (mesajlar[yeniDurum]) {
    notify(db, transfer.user_id, transferId, TRANSFER_FLOW[nextIdx].label, mesajlar[yeniDurum]);
  }

  return { message: `Durum güncellendi: ${TRANSFER_FLOW[nextIdx].label}`, durum: yeniDurum, ...extra };
}

function cancelTransfer(db, transferId, actor) {
  const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(transferId);
  if (!transfer) return { error: 'Transfer bulunamadı', status: 404 };

  const isOwner = actor.role === 'member' && Number(transfer.user_id) === Number(actor.id);
  const isStaff = ['admin', 'librarian'].includes(actor.role);
  if (!isOwner && !isStaff) return { error: 'Yetkiniz yok', status: 403 };

  if (isOwner && !IPTAL_EDILEBILIR.includes(transfer.durum)) {
    return { error: 'Bu aşamada iptal edilemez, lütfen kütüphane ile iletişime geçin', status: 400 };
  }
  if (!AKTIF_DURUMLAR.includes(transfer.durum)) {
    return { error: 'Bu transfer iptal edilemez', status: 400 };
  }

  db.prepare("UPDATE transfers SET durum = 'iptal', iptal_tarihi = datetime('now') WHERE id = ?").run(transferId);
  releaseCopy(db, transfer.copy_id);

  const book = db.prepare('SELECT ad FROM books WHERE id = ?').get(transfer.book_id);
  notify(db, transfer.user_id, transferId, 'Transfer iptal edildi', `"${book.ad}" transfer talebi iptal edildi.`);

  return { message: 'Transfer iptal edildi' };
}

function enrichTransfer(db, t) {
  const adimlar = TRANSFER_FLOW.map((step) => ({
    durum: step.durum,
    label: step.label,
    tarih: t[step.tarih_alani] || null,
    tamam: STATE_INDEX[t.durum] >= STATE_INDEX[step.durum] && t.durum !== 'iptal',
    aktif: t.durum === step.durum,
  }));
  const aktifAdimLabel = TRANSFER_FLOW[STATE_INDEX[t.durum]]?.label
    || (t.durum === 'iptal' ? 'İptal edildi' : t.durum);
  return {
    ...t,
    adimlar,
    aktif_adim_label: aktifAdimLabel,
    iptal_edilebilir_uye: IPTAL_EDILEBILIR.includes(t.durum),
    tamamlandi: t.durum === 'teslim_edildi',
  };
}

const BASE_SELECT = `
  SELECT t.*, b.ad as kitap_adi, b.yazar, b.isbn,
         u.ad, u.soyad, u.okul_no,
         ks.ad as kaynak_sube_adi, hs.ad as hedef_sube_adi,
         c.barkod, c.kopya_no
  FROM transfers t
  JOIN books b ON t.book_id = b.id
  JOIN users u ON t.user_id = u.id
  JOIN library_branches ks ON t.kaynak_sube_id = ks.id
  JOIN library_branches hs ON t.hedef_sube_id = hs.id
  LEFT JOIN book_copies c ON t.copy_id = c.id
`;

function getUserTransfers(db, userId) {
  const rows = db.prepare(`${BASE_SELECT} WHERE t.user_id = ? ORDER BY t.talep_tarihi DESC`).all(userId);
  return rows.map((r) => enrichTransfer(db, r));
}

function getManageableTransfers(db, actor, filterDurum) {
  let sql = BASE_SELECT + ' WHERE 1=1';
  const params = [];
  if (actor.role === 'librarian') {
    const row = db.prepare('SELECT branch_id FROM users WHERE id = ?').get(actor.id);
    const bid = row?.branch_id;
    if (bid) {
      sql += ' AND (t.kaynak_sube_id = ? OR t.hedef_sube_id = ?)';
      params.push(bid, bid);
    }
  }
  if (filterDurum) {
    if (filterDurum === 'aktif') {
      sql += ` AND t.durum IN (${AKTIF_DURUMLAR.map(() => '?').join(',')})`;
      params.push(...AKTIF_DURUMLAR);
    } else {
      sql += ' AND t.durum = ?';
      params.push(filterDurum);
    }
  }
  sql += ' ORDER BY t.talep_tarihi DESC LIMIT 300';
  return db.prepare(sql).all(...params).map((r) => enrichTransfer(db, r));
}

function getActiveTransferForBook(db, userId, bookId) {
  const row = db.prepare(`
    ${BASE_SELECT}
    WHERE t.user_id = ? AND t.book_id = ?
      AND t.durum IN ('talep','onaylandi','hazirlaniyor','transfer_edildi','teslim_noktasinda')
    ORDER BY t.talep_tarihi DESC LIMIT 1
  `).get(userId, bookId);
  return row ? enrichTransfer(db, row) : null;
}

module.exports = {
  TRANSFER_FLOW,
  AKTIF_DURUMLAR,
  createTransfer,
  setTransferStatus,
  cancelTransfer,
  getUserTransfers,
  getManageableTransfers,
  getActiveTransferForBook,
  enrichTransfer,
};
