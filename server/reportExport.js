const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const REPORT_TYPES = {
  daily_loans: { id: 'daily_loans', label: 'Günlük Ödünç Raporu' },
  overdue_books: { id: 'overdue_books', label: 'Geciken Kitaplar' },
  penalties: { id: 'penalties', label: 'Ceza Raporu' },
  inventory: { id: 'inventory', label: 'Envanter Raporu' },
  user_activity: { id: 'user_activity', label: 'Kullanıcı Aktivite Raporu' },
  branch_performance: { id: 'branch_performance', label: 'Şube Performans Raporu' },
  book_usage: { id: 'book_usage', label: 'Kitap Kullanım Raporu' },
};

function queryDailyLoans(db, filters = {}) {
  const date = filters.date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT l.id, b.ad AS kitap, b.yazar, u.ad || ' ' || u.soyad AS uye,
           u.okul_no, l.odunc_tarihi, l.teslim_tarihi, l.durum,
           lb.ad AS sube
    FROM loans l
    JOIN books b ON l.book_id = b.id
    JOIN users u ON l.user_id = u.id
    LEFT JOIN book_copies c ON l.copy_id = c.id
    LEFT JOIN library_branches lb ON c.branch_id = lb.id
    WHERE date(l.odunc_tarihi) = ?
    ORDER BY l.odunc_tarihi DESC
  `).all(date);
  return { title: `Günlük Ödünç Raporu — ${date}`, columns: ['ID', 'Kitap', 'Yazar', 'Üye', 'Okul No', 'Ödünç Tarihi', 'Teslim Tarihi', 'Durum', 'Şube'], rows: rows.map(r => [r.id, r.kitap, r.yazar, r.uye, r.okul_no || '-', r.odunc_tarihi, r.teslim_tarihi, r.durum, r.sube || '-']) };
}

function queryOverdueBooks(db) {
  const rows = db.prepare(`
    SELECT l.id, b.ad AS kitap, b.yazar, u.ad || ' ' || u.soyad AS uye,
           u.okul_no, u.email, l.teslim_tarihi,
           CAST(julianday('now') - julianday(l.teslim_tarihi) AS INTEGER) AS gecikme_gun,
           lb.ad AS sube
    FROM loans l
    JOIN books b ON l.book_id = b.id
    JOIN users u ON l.user_id = u.id
    LEFT JOIN book_copies c ON l.copy_id = c.id
    LEFT JOIN library_branches lb ON c.branch_id = lb.id
    WHERE l.durum IN ('aktif','gecikti') AND l.teslim_tarihi < datetime('now')
    ORDER BY l.teslim_tarihi
  `).all();
  return { title: 'Geciken Kitaplar Raporu', columns: ['ID', 'Kitap', 'Yazar', 'Üye', 'Okul No', 'E-posta', 'Teslim Tarihi', 'Gecikme (gün)', 'Şube'], rows: rows.map(r => [r.id, r.kitap, r.yazar, r.uye, r.okul_no || '-', r.email || '-', r.teslim_tarihi, r.gecikme_gun, r.sube || '-']) };
}

function queryPenalties(db, filters = {}) {
  let where = '1=1';
  const params = [];
  if (filters.durum) { where += ' AND p.durum = ?'; params.push(filters.durum); }
  const rows = db.prepare(`
    SELECT p.id, u.ad || ' ' || u.soyad AS uye, u.okul_no, p.tur, p.tutar,
           p.durum, p.aciklama, p.tarih, b.ad AS kitap
    FROM penalties p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN books b ON p.book_id = b.id
    WHERE ${where}
    ORDER BY p.tarih DESC
  `).all(...params);
  return { title: 'Ceza Raporu', columns: ['ID', 'Üye', 'Okul No', 'Tür', 'Tutar (₺)', 'Durum', 'Açıklama', 'Tarih', 'Kitap'], rows: rows.map(r => [r.id, r.uye, r.okul_no || '-', r.tur || '-', r.tutar, r.durum, r.aciklama || '-', r.tarih, r.kitap || '-']) };
}

function queryInventory(db, filters = {}) {
  let where = '1=1';
  const params = [];
  if (filters.branch_id) { where += ' AND c.branch_id = ?'; params.push(+filters.branch_id); }
  const rows = db.prepare(`
    SELECT b.id, b.ad AS kitap, b.yazar, b.isbn, b.kategori, b.stok,
           COUNT(c.id) AS kopya_sayisi,
           SUM(CASE WHEN c.durum = 'rafta' THEN 1 ELSE 0 END) AS rafta,
           SUM(CASE WHEN c.durum = 'odunc' THEN 1 ELSE 0 END) AS odunc,
           lb.ad AS sube
    FROM books b
    LEFT JOIN book_copies c ON c.book_id = b.id AND ${where}
    LEFT JOIN library_branches lb ON c.branch_id = lb.id
    GROUP BY b.id
    ORDER BY b.ad
  `).all(...params);
  return { title: 'Envanter Raporu', columns: ['ID', 'Kitap', 'Yazar', 'ISBN', 'Kategori', 'Stok', 'Kopya', 'Rafta', 'Ödünç'], rows: rows.map(r => [r.id, r.kitap, r.yazar, r.isbn || '-', r.kategori || '-', r.stok, r.kopya_sayisi, r.rafta || 0, r.odunc || 0]) };
}

function queryUserActivity(db) {
  const rows = db.prepare(`
    SELECT u.id, u.ad || ' ' || u.soyad AS uye, u.okul_no, u.email, u.bolum,
           u.uyelik_durumu,
           (SELECT COUNT(*) FROM loans WHERE user_id = u.id) AS toplam_odunc,
           (SELECT COUNT(*) FROM loans WHERE user_id = u.id AND durum IN ('aktif','gecikti')) AS aktif_odunc,
           (SELECT COUNT(*) FROM loans WHERE user_id = u.id AND durum = 'gecikti') AS geciken,
           (SELECT COUNT(*) FROM ratings WHERE user_id = u.id) AS degerlendirme,
           (SELECT COUNT(*) FROM favorites WHERE user_id = u.id) AS favori,
           u.created_at
    FROM users u WHERE u.role = 'member'
    ORDER BY toplam_odunc DESC
  `).all();
  return { title: 'Kullanıcı Aktivite Raporu', columns: ['ID', 'Üye', 'Okul No', 'E-posta', 'Bölüm', 'Durum', 'Toplam Ödünç', 'Aktif', 'Geciken', 'Değerlendirme', 'Favori', 'Kayıt Tarihi'], rows: rows.map(r => [r.id, r.uye, r.okul_no || '-', r.email || '-', r.bolum || '-', r.uyelik_durumu, r.toplam_odunc, r.aktif_odunc, r.geciken, r.degerlendirme, r.favori, r.created_at]) };
}

function queryBranchPerformance(db) {
  const branches = db.prepare('SELECT * FROM library_branches ORDER BY ad').all();
  const rows = branches.map(br => {
    const copies = db.prepare('SELECT COUNT(*) as c FROM book_copies WHERE branch_id = ?').get(br.id).c;
    const onShelf = db.prepare("SELECT COUNT(*) as c FROM book_copies WHERE branch_id = ? AND durum = 'rafta'").get(br.id).c;
    const onLoan = db.prepare("SELECT COUNT(*) as c FROM book_copies WHERE branch_id = ? AND durum = 'odunc'").get(br.id).c;
    const totalLoans = db.prepare(`
      SELECT COUNT(*) as c FROM loans l JOIN book_copies c ON l.copy_id = c.id WHERE c.branch_id = ?
    `).get(br.id).c;
    const overdue = db.prepare(`
      SELECT COUNT(*) as c FROM loans l JOIN book_copies c ON l.copy_id = c.id
      WHERE c.branch_id = ? AND l.durum IN ('aktif','gecikti') AND l.teslim_tarihi < datetime('now')
    `).get(br.id).c;
    const members = db.prepare('SELECT COUNT(*) as c FROM users WHERE branch_id = ?').get(br.id).c;
    return [br.id, br.ad, br.durum, copies, onShelf, onLoan, totalLoans, overdue, members];
  });
  return { title: 'Şube Performans Raporu', columns: ['ID', 'Şube', 'Durum', 'Kopya', 'Rafta', 'Ödünç', 'Toplam İşlem', 'Geciken', 'Üye'], rows };
}

function queryBookUsage(db) {
  const rows = db.prepare(`
    SELECT b.id, b.ad AS kitap, b.yazar, b.kategori, b.isbn,
           (SELECT COUNT(*) FROM loans WHERE book_id = b.id) AS odunc_sayisi,
           (SELECT AVG(puan) FROM ratings WHERE book_id = b.id) AS ort_puan,
           (SELECT COUNT(*) FROM ratings WHERE book_id = b.id) AS degerlendirme,
           (SELECT COUNT(*) FROM favorites WHERE book_id = b.id) AS favori,
           (SELECT COUNT(*) FROM book_views WHERE book_id = b.id) AS goruntulenme
    FROM books b
    ORDER BY odunc_sayisi DESC
    LIMIT 200
  `).all();
  return { title: 'Kitap Kullanım Raporu', columns: ['ID', 'Kitap', 'Yazar', 'Kategori', 'ISBN', 'Ödünç Sayısı', 'Ort. Puan', 'Değerlendirme', 'Favori', 'Görüntülenme'], rows: rows.map(r => [r.id, r.kitap, r.yazar, r.kategori || '-', r.isbn || '-', r.odunc_sayisi, r.ort_puan ? r.ort_puan.toFixed(1) : '-', r.degerlendirme, r.favori, r.goruntulenme]) };
}

const QUERY_FNS = {
  daily_loans: queryDailyLoans,
  overdue_books: queryOverdueBooks,
  penalties: queryPenalties,
  inventory: queryInventory,
  user_activity: queryUserActivity,
  branch_performance: queryBranchPerformance,
  book_usage: queryBookUsage,
};

function getReportData(db, reportType, filters) {
  const fn = QUERY_FNS[reportType];
  if (!fn) return null;
  return fn(db, filters);
}

function generateCSV(data) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [data.columns.map(escape).join(',')];
  for (const row of data.rows) {
    lines.push(row.map(escape).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

async function generateExcel(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dijital Kütüphane Portalı';
  wb.created = new Date();
  const ws = wb.addWorksheet(data.title.slice(0, 31));

  ws.addRow([data.title]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.mergeCells(1, 1, 1, data.columns.length);

  ws.addRow([`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`]);
  ws.getRow(2).font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  ws.mergeCells(2, 1, 2, data.columns.length);

  ws.addRow([]);

  const headerRow = ws.addRow(data.columns);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
    cell.alignment = { horizontal: 'center' };
  });

  for (const row of data.rows) {
    ws.addRow(row);
  }

  data.columns.forEach((_, i) => {
    const col = ws.getColumn(i + 1);
    let maxLen = data.columns[i].length;
    for (const row of data.rows) {
      const len = String(row[i] ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    col.width = Math.min(maxLen + 4, 40);
  });

  ws.addRow([]);
  const totalRow = ws.addRow([`Toplam: ${data.rows.length} kayıt`]);
  totalRow.font = { bold: true, size: 10 };

  return wb.xlsx.writeBuffer();
}

function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text(data.title, { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8).fillColor('#666')
      .text(`Olusturulma: ${new Date().toLocaleString('tr-TR')}  |  Toplam: ${data.rows.length} kayit`, { align: 'center' });
    doc.moveDown(0.8);

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const maxCols = Math.min(data.columns.length, 10);
    const colW = pageW / maxCols;
    const startX = doc.page.margins.left;
    const rowH = 18;
    let y = doc.y;

    const drawRow = (cells, isHeader) => {
      if (y + rowH > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      if (isHeader) {
        doc.rect(startX, y, pageW, rowH).fill('#2563EB');
        doc.fillColor('#FFFFFF');
      } else {
        doc.fillColor('#1a1a2e');
      }
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
      for (let i = 0; i < maxCols; i++) {
        const val = String(cells[i] ?? '').slice(0, 30);
        doc.text(val, startX + i * colW + 3, y + 4, { width: colW - 6, height: rowH, lineBreak: false });
      }
      y += rowH;
      if (!isHeader) {
        doc.strokeColor('#e0e0e0').lineWidth(0.3).moveTo(startX, y).lineTo(startX + pageW, y).stroke();
      }
    };

    drawRow(data.columns.slice(0, maxCols), true);
    for (const row of data.rows) {
      drawRow(row.slice(0, maxCols), false);
    }

    doc.end();
  });
}

module.exports = { REPORT_TYPES, getReportData, generateCSV, generateExcel, generatePDF };
