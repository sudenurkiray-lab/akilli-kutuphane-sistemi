const DESK_TIME_SLOTS = [
  { baslangic: '08:00', bitis: '10:00', label: '08:00 – 10:00' },
  { baslangic: '10:00', bitis: '12:00', label: '10:00 – 12:00' },
  { baslangic: '12:00', bitis: '14:00', label: '12:00 – 14:00' },
  { baslangic: '14:00', bitis: '16:00', label: '14:00 – 16:00' },
  { baslangic: '16:00', bitis: '18:00', label: '16:00 – 18:00' },
  { baslangic: '18:00', bitis: '20:00', label: '18:00 – 20:00' },
];

const FLOORS = [
  { id: 'zemin', ad: 'Zemin Kat', sira: 0 },
  { id: 'kat1', ad: '1. Kat', sira: 1 },
  { id: 'kat2', ad: '2. Kat', sira: 2 },
];

const SALONS = [
  { id: 'zemin-salon-a', kat_id: 'zemin', ad: 'Salon A', aciklama: 'Sessiz çalışma salonu', kolon: 6, satir: 4 },
  { id: 'zemin-salon-b', kat_id: 'zemin', ad: 'Salon B', aciklama: 'Grup çalışma salonu', kolon: 6, satir: 4 },
  { id: 'kat1-salon-a', kat_id: 'kat1', ad: 'Salon A', aciklama: 'Bireysel çalışma alanı', kolon: 6, satir: 4 },
  { id: 'kat1-salon-b', kat_id: 'kat1', ad: 'Salon B', aciklama: 'Araştırma salonu', kolon: 6, satir: 4 },
  { id: 'kat2-salon-a', kat_id: 'kat2', ad: 'Salon A', aciklama: 'Sessiz okuma salonu', kolon: 6, satir: 4 },
  { id: 'kat2-salon-b', kat_id: 'kat2', ad: 'Salon B', aciklama: 'Proje çalışma salonu', kolon: 6, satir: 4 },
];

const INACTIVE_DESKS = new Set([
  'zemin-salon-a-m03', 'zemin-salon-a-m11', 'zemin-salon-b-m08',
  'kat1-salon-a-m15', 'kat1-salon-b-m02', 'kat2-salon-a-m20', 'kat2-salon-b-m05',
]);

function buildDesks() {
  const desks = [];
  SALONS.forEach((salon) => {
    let no = 1;
    for (let y = 0; y < salon.satir; y++) {
      for (let x = 0; x < salon.kolon; x++) {
        const id = `${salon.id}-m${String(no).padStart(2, '0')}`;
        desks.push({
          id,
          salon_id: salon.id,
          masa_no: no,
          grid_x: x,
          grid_y: y,
          aktif: !INACTIVE_DESKS.has(id),
        });
        no += 1;
      }
    }
  });
  return desks;
}

const DESKS = buildDesks();

function getFloors() {
  return FLOORS;
}

function getSalonsByFloor(katId) {
  return SALONS.filter((s) => s.kat_id === katId);
}

function getSalonById(id) {
  return SALONS.find((s) => s.id === id) || null;
}

function getDeskById(id) {
  return DESKS.find((d) => d.id === id) || null;
}

function getDesksBySalon(salonId) {
  return DESKS.filter((d) => d.salon_id === salonId);
}

function getSlotIndex(baslangic) {
  return DESK_TIME_SLOTS.findIndex((s) => s.baslangic === baslangic);
}

function getSlotByTime(baslangic, bitis) {
  return DESK_TIME_SLOTS.find((s) => s.baslangic === baslangic && s.bitis === bitis) || null;
}

function getReservationsForSalonDate(db, salonId, tarih) {
  return db.prepare(`
    SELECT * FROM desk_reservations
    WHERE salon_id = ? AND tarih = ? AND durum IN ('onaylandi', 'aktif')
  `).all(salonId, tarih);
}

function computeDeskStatus(desk, tarih, baslangic, reservations) {
  if (!desk.aktif) {
    return { durum: 'kullanim_disi', renk: 'gri', etiket: 'Kullanım dışı' };
  }

  const slotIdx = getSlotIndex(baslangic);
  const deskRes = reservations.filter((r) => r.desk_id === desk.id);

  const current = deskRes.find((r) => r.baslangic === baslangic);
  if (current) {
    return { durum: 'dolu', renk: 'kirmizi', etiket: 'Dolu' };
  }

  const nextSlot = DESK_TIME_SLOTS[slotIdx + 1];
  if (nextSlot) {
    const nextBooked = deskRes.find((r) => r.baslangic === nextSlot.baslangic);
    if (nextBooked) {
      return { durum: 'yakinda_dolu', renk: 'sari', etiket: 'Yakında dolacak' };
    }
  }

  return { durum: 'bos', renk: 'yesil', etiket: 'Boş' };
}

function getDeskGrid(db, salonId, tarih, baslangic, bitis) {
  const salon = getSalonById(salonId);
  if (!salon) return null;

  const slot = getSlotByTime(baslangic, bitis);
  if (!slot) return null;

  const reservations = getReservationsForSalonDate(db, salonId, tarih);
  const desks = getDesksBySalon(salonId).map((desk) => {
    const status = computeDeskStatus(desk, tarih, baslangic, reservations);
    return { ...desk, ...status };
  });

  const ozet = {
    toplam: desks.length,
    bos: desks.filter((d) => d.durum === 'bos').length,
    dolu: desks.filter((d) => d.durum === 'dolu').length,
    yakinda_dolu: desks.filter((d) => d.durum === 'yakinda_dolu').length,
    kullanim_disi: desks.filter((d) => d.durum === 'kullanim_disi').length,
  };

  return { salon, tarih, slot, desks, ozet, kolon: salon.kolon, satir: salon.satir };
}

function seedDemoDeskReservations(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM desk_reservations').get().c;
  if (count > 0) return;

  const today = new Date();
  const tarih = today.toISOString().slice(0, 10);
  const insert = db.prepare(`
    INSERT INTO desk_reservations (user_id, desk_id, salon_id, tarih, baslangic, bitis, durum)
    VALUES (?, ?, ?, ?, ?, ?, 'onaylandi')
  `);

  // ogrenci2 için birkaç dolu masa
  insert.run(4, 'zemin-salon-a-m01', 'zemin-salon-a', tarih, '10:00', '12:00');
  insert.run(4, 'zemin-salon-a-m02', 'zemin-salon-a', tarih, '10:00', '12:00');
  insert.run(4, 'zemin-salon-a-m05', 'zemin-salon-a', tarih, '12:00', '14:00');
  // m05 için 10-12 boş ama 12-14 dolu → sarı 10-12 slotunda
  insert.run(4, 'zemin-salon-a-m07', 'zemin-salon-a', tarih, '14:00', '16:00');
  insert.run(4, 'kat1-salon-a-m04', 'kat1-salon-a', tarih, '10:00', '12:00');
}

module.exports = {
  DESK_TIME_SLOTS,
  FLOORS,
  SALONS,
  DESKS,
  getFloors,
  getSalonsByFloor,
  getSalonById,
  getDeskById,
  getDeskGrid,
  getSlotByTime,
  seedDemoDeskReservations,
};
