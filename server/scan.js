const { getRoomById, getRoomByRaf } = require('./rooms');
const {
  syncBookStock,
  assignCopyToLoan,
  releaseCopy,
} = require('./copies');
const { upsertOverduePenalty } = require('./notifications');
const RULES = require('./rules');
const { hasUnpaidPenalties } = require('./advancedPenalties');
const { onBookReturned, findCopyForLoan, completeReservationOnBorrow } = require('./reservationQueue');
const { processLoanReturn } = require('./bookReturnInspection');

const LOAN_DAYS = RULES.LOAN_DAYS;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function generateMemberQr(user) {
  if (user.uye_karti_qr) return user.uye_karti_qr;
  return user.okul_no ? `UYE-${user.okul_no}` : `UYE-${user.id}`;
}

function copyRoomLabel(db, bookId) {
  const book = db.prepare('SELECT oda, raf_no FROM books WHERE id = ?').get(bookId);
  if (!book) return null;
  const room = getRoomById(book.oda) || getRoomByRaf(book.raf_no);
  return room?.ad || book.oda || null;
}

function enrichCopy(db, copy) {
  const activeLoan = db.prepare(`
    SELECT l.id, l.teslim_tarihi, u.ad, u.soyad, u.okul_no
    FROM loans l JOIN users u ON l.user_id = u.id
    WHERE l.copy_id = ? AND l.durum IN ('aktif', 'gecikti')
  `).get(copy.id);
  return {
    ...copy,
    musait: copy.fiziksel_durum === 'rafta',
    aktif_odunc: activeLoan || null,
    oda_adi: copyRoomLabel(db, copy.book_id),
  };
}

function parseCopyBarkod(raw) {
  const code = raw.trim();
  if (code.includes('/kopya/')) {
    return code.split('/kopya/').pop().split('?')[0].trim();
  }
  if (code.startsWith('KTP-')) return code;
  return code;
}

function parseMemberKey(raw) {
  const code = raw.trim();
  if (code.includes('/uye/')) {
    return code.split('/uye/').pop().split('?')[0].trim();
  }
  if (code.startsWith('UYE-')) return code.slice(4);
  return code;
}

function findCopyByCode(db, raw) {
  const barkod = parseCopyBarkod(raw);
  return db.prepare(`
    SELECT c.*, b.ad as kitap_adi, b.yazar, b.kategori, b.isbn, b.id as book_ref_id
    FROM book_copies c
    JOIN books b ON c.book_id = b.id
    WHERE c.barkod = ? OR c.qr_kod = ?
  `).get(barkod, raw.trim());
}

function findMemberByCode(db, raw) {
  const key = parseMemberKey(raw);
  const trimmed = raw.trim();
  return db.prepare(`
    SELECT id, ad, soyad, okul_no, email, telefon, bolum, uyelik_durumu, uye_karti_qr
    FROM users
    WHERE role = 'member' AND (
      uye_karti_qr = ? OR uye_karti_qr = ? OR okul_no = ? OR CAST(id AS TEXT) = ?
    )
    LIMIT 1
  `).get(trimmed, `UYE-${key}`, key, key);
}

function lookupScanCode(db, raw) {
  const code = raw.trim();
  if (!code) return { type: 'invalid', error: 'Kod boş' };

  if (code.startsWith('UYE-') || code.includes('/uye/') || /^20\d{5}$/.test(parseMemberKey(code))) {
    const member = findMemberByCode(db, code);
    if (member) {
      const qr = member.uye_karti_qr || generateMemberQr(member);
      return {
        type: 'member',
        member: { ...member, uye_karti_qr: qr, qr_url: `https://kutuphane.edu.tr/uye/${qr}` },
      };
    }
  }

  if (code.startsWith('KTP-') || code.includes('/kopya/')) {
    const copy = findCopyByCode(db, code);
    if (copy) {
      return { type: 'copy', copy: enrichCopy(db, copy) };
    }
  }

  const member = findMemberByCode(db, code);
  if (member) {
    const qr = member.uye_karti_qr || generateMemberQr(member);
    return {
      type: 'member',
      member: { ...member, uye_karti_qr: qr, qr_url: `https://kutuphane.edu.tr/uye/${qr}` },
    };
  }

  const copy = findCopyByCode(db, code);
  if (copy) {
    return { type: 'copy', copy: enrichCopy(db, copy) };
  }

  return { type: 'not_found', error: 'Kod tanınmadı' };
}

function scanLend(db, memberCode, copyCode) {
  const member = findMemberByCode(db, memberCode);
  if (!member) return { error: 'Üye kartı bulunamadı', status: 404 };
  if (member.uyelik_durumu !== 'aktif') return { error: 'Üyelik aktif değil', status: 400 };

  const copy = findCopyByCode(db, copyCode);
  if (!copy) return { error: 'Kitap kopyası bulunamadı', status: 404 };
  if (copy.fiziksel_durum !== 'rafta' && copy.fiziksel_durum !== 'rezerve') {
    return { error: `Kopya müsait değil (durum: ${copy.fiziksel_durum})`, status: 400 };
  }

  const hazirOther = db.prepare(`
    SELECT id FROM reservations WHERE book_id = ? AND durum = 'hazir' AND user_id != ?
  `).get(copy.book_id, member.id);
  if (hazirOther && copy.fiziksel_durum === 'rezerve') {
    return { error: 'Bu kitap başka bir kullanıcı için rezerve', status: 400 };
  }

  const activeLoans = db.prepare(`
    SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND durum IN ('aktif', 'gecikti')
  `).get(member.id).c;
  if (activeLoans >= RULES.MAX_LOANS_PER_MEMBER) {
    return { error: `Maksimum ${RULES.MAX_LOANS_PER_MEMBER} kitap ödünç alınabilir`, status: 400 };
  }

  if (hasUnpaidPenalties(db, member.id)) return { error: 'Ödenmemiş ceza var', status: 400 };

  const teslim = addDays(new Date(), LOAN_DAYS);
  const result = db.prepare(`
    INSERT INTO loans (user_id, book_id, copy_id, teslim_tarihi, durum) VALUES (?, ?, ?, ?, 'aktif')
  `).run(member.id, copy.book_id, copy.id, teslim);

  assignCopyToLoan(db, copy.id);
  syncBookStock(db, copy.book_id);
  completeReservationOnBorrow(db, member.id, copy.book_id);

  return {
    status: 201,
    message: 'Ödünç verildi',
    loan: {
      id: result.lastInsertRowid,
      teslim_tarihi: teslim,
      uye: `${member.ad} ${member.soyad}`,
      kitap: copy.kitap_adi,
      barkod: copy.barkod,
      kopya_no: copy.kopya_no,
    },
  };
}

function scanReturn(db, copyCode, actorId, inspection = {}) {
  const copy = findCopyByCode(db, copyCode);
  if (!copy) return { error: 'Kitap kopyası bulunamadı', status: 404 };

  const loan = db.prepare(`
    SELECT * FROM loans WHERE copy_id = ? AND durum IN ('aktif', 'gecikti')
  `).get(copy.id);

  if (!loan) {
    if (copy.fiziksel_durum === 'rafta') {
      return { error: 'Bu kopya zaten rafta', status: 400 };
    }
    db.prepare("UPDATE book_copies SET fiziksel_durum = 'rafta' WHERE id = ?").run(copy.id);
    syncBookStock(db, copy.book_id);
    return { message: 'Kopya rafta olarak işaretlendi', copy: { barkod: copy.barkod } };
  }

  const result = processLoanReturn(db, loan, actorId, inspection);
  if (result.error) return result;

  return {
    ...result,
    copy: { barkod: copy.barkod, kitap: copy.kitap_adi },
  };
}

function scanDamage(db, copyCode, aciklama, reporterId) {
  const copy = findCopyByCode(db, copyCode);
  if (!copy) return { error: 'Kitap kopyası bulunamadı', status: 404 };

  const loan = db.prepare(`
    SELECT id FROM loans WHERE copy_id = ? AND durum IN ('aktif', 'gecikti')
  `).get(copy.id);
  if (loan) scanReturn(db, copyCode);

  db.prepare("UPDATE book_copies SET fiziksel_durum = 'hasarli' WHERE id = ?").run(copy.id);
  db.prepare(`
    INSERT INTO damage_records (copy_id, bildiren_id, aciklama) VALUES (?, ?, ?)
  `).run(copy.id, reporterId, aciklama || 'Hasar tespit edildi');
  syncBookStock(db, copy.book_id);

  return {
    message: 'Hasar kaydı oluşturuldu',
    copy: { barkod: copy.barkod, kitap: copy.kitap_adi, durum: 'hasarli' },
  };
}

function migrateMemberQrCodes(db) {
  const members = db.prepare("SELECT id, okul_no, uye_karti_qr FROM users WHERE role = 'member'").all();
  const update = db.prepare('UPDATE users SET uye_karti_qr = ? WHERE id = ?');
  members.forEach((m) => {
    if (!m.uye_karti_qr) {
      update.run(m.okul_no ? `UYE-${m.okul_no}` : `UYE-${m.id}`, m.id);
    }
  });
}

module.exports = {
  generateMemberQr,
  lookupScanCode,
  scanLend,
  scanReturn,
  scanDamage,
  migrateMemberQrCodes,
  findCopyByCode,
  findMemberByCode,
};
