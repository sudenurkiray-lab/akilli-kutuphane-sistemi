const API_BASE = '/api';

export async function api(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error('API sunucusuna bağlanılamadı. Proje klasöründe npm run dev ile backend\'i başlatın (port 3001).');
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Sunucudan geçersiz yanıt alındı. API çalışıyor mu kontrol edin (npm run dev).');
    }
  } else if (!res.ok) {
    throw new Error('Sunucuya bağlanılamadı. Lütfen backend\'in çalıştığından emin olun (npm run dev).');
  }

  if (!res.ok) {
    if (res.status === 413) {
      throw new Error('Dosya çok büyük. Daha küçük bir görsel veya PDF deneyin (en fazla 4 MB).');
    }
    throw new Error(data.error || 'Bir hata oluştu');
  }
  return data;
}

export const authApi = {
  captcha: () => api('/auth/captcha'),
  recaptchaKey: () => api('/auth/recaptcha-key'),
  login: (data) => api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  login2fa: (data) => api('/auth/login/2fa', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api('/auth/me'),
  forgotPassword: (data) => api('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
  resetPassword: (data) => api('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmail: (token) => api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: () => api('/auth/resend-verification', { method: 'POST', body: '{}' }),
  security: () => api('/auth/security'),
  changePassword: (data) => api('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  setup2fa: () => api('/auth/2fa/setup', { method: 'POST', body: '{}' }),
  enable2fa: (code) => api('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2fa: (data) => api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify(data) }),
  setLocale: (locale) => api('/auth/locale', { method: 'PUT', body: JSON.stringify({ locale }) }),
};

export const booksApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/books${q ? `?${q}` : ''}`);
  },
  categories: () => api('/books/categories'),
  view: (id) => api(`/books/${id}/view`, { method: 'POST' }),
  create: (data) => api('/books', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/books/${id}`, { method: 'DELETE' }),
};

export const recommendationsApi = {
  get: () => api('/recommendations'),
};

export const favoritesApi = {
  list: () => api('/favorites'),
  add: (bookId) => api(`/favorites/${bookId}`, { method: 'POST' }),
  remove: (bookId) => api(`/favorites/${bookId}`, { method: 'DELETE' }),
};

export const ratingsApi = {
  set: (book_id, puan) => api('/ratings', { method: 'POST', body: JSON.stringify({ book_id, puan }) }),
};

export const reviewsApi = {
  list: (bookId) => api(`/books/${bookId}/reviews`),
  submit: (bookId, data) => api(`/books/${bookId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  like: (reviewId) => api(`/reviews/${reviewId}/like`, { method: 'POST' }),
  report: (reviewId, sebep) => api(`/reviews/${reviewId}/report`, { method: 'POST', body: JSON.stringify({ sebep }) }),
  remove: (reviewId) => api(`/reviews/${reviewId}`, { method: 'DELETE' }),
  reported: () => api('/reviews/reported'),
};

export const readingListsApi = {
  mine: () => api('/reading-lists'),
  public: () => api('/reading-lists?public=1'),
  get: (id) => api(`/reading-lists/${id}`),
  create: (data) => api('/reading-lists', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/reading-lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => api(`/reading-lists/${id}`, { method: 'DELETE' }),
  addBook: (listId, book_id, not_metni) => api(`/reading-lists/${listId}/items`, {
    method: 'POST', body: JSON.stringify({ book_id, not_metni }),
  }),
  removeBook: (listId, bookId) => api(`/reading-lists/${listId}/items/${bookId}`, { method: 'DELETE' }),
};

export const gamificationApi = {
  me: () => api('/gamification/me'),
};

export const readingStatsApi = {
  me: () => api('/reading-stats/me'),
};

export const copiesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/copies${q ? `?${q}` : ''}`);
  },
  byBook: (bookId) => api(`/books/${bookId}/copies`),
  create: (data) => api('/copies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/copies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/copies/${id}`, { method: 'DELETE' }),
};

export const eventsApi = {
  types: () => api('/events/types'),
  list: () => api('/events'),
  get: (id) => api(`/events/${id}`),
  my: () => api('/events/my'),
  create: (data) => api('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  complete: (id) => api(`/events/${id}/complete`, { method: 'POST' }),
  register: (id) => api(`/events/${id}/register`, { method: 'POST' }),
  cancelRegister: (id) => api(`/events/${id}/register`, { method: 'DELETE' }),
  registrations: (id) => api(`/events/${id}/registrations`),
  markAttend: (regId, katildi = true) => api(`/events/registrations/${regId}/attend`, {
    method: 'PUT', body: JSON.stringify({ katildi }),
  }),
  certificate: (regId) => api(`/events/registrations/${regId}/certificate`),
};

export const digitalResourcesApi = {
  types: () => api('/digital-resources/types'),
  accessLevels: () => api('/digital-resources/access-levels'),
  licenses: () => api('/digital-resources/licenses'),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/digital-resources${q ? `?${q}` : ''}`);
  },
  get: (id) => api(`/digital-resources/${id}`),
  create: (data) => api('/digital-resources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/digital-resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  archive: (id) => api(`/digital-resources/${id}`, { method: 'DELETE' }),
  logs: (id) => api(`/digital-resources/${id}/logs`),
  view: (id) => api(`/digital-resources/${id}/view`, { method: 'POST' }),
  downloadBlob: async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/digital-resources/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { /* */ }
      throw new Error(data.error || 'İndirme başarısız');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    const match = disposition?.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || `kaynak-${id}` };
  },
};

export const thesisArchiveApi = {
  filters: () => api('/thesis-archive/filters'),
  list: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const data = await api(`/thesis-archive${q ? `?${q}` : ''}`);
    if (data && Array.isArray(data.items)) return data;
    return { items: data, total: data.length, limit: data.length, offset: 0 };
  },
  pending: () => api('/thesis-archive/pending'),
  get: (id) => api(`/thesis-archive/${id}`),
  submit: (data) => api('/thesis-archive', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => api(`/thesis-archive/${id}/approve`, { method: 'PUT' }),
  reject: (id, red_nedeni) => api(`/thesis-archive/${id}/reject`, {
    method: 'PUT', body: JSON.stringify({ red_nedeni }),
  }),
  downloadBlob: async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/thesis-archive/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { /* */ }
      throw new Error(data.error || 'İndirme başarısız');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    const match = disposition?.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || `arsiv-${id}` };
  },
};

export const desksApi = {
  floors: () => api('/desks/floors'),
  salons: (kat_id) => api(`/desks/salons?kat_id=${kat_id}`),
  slots: () => api('/desks/slots'),
  grid: (salon_id, tarih, baslangic, bitis) =>
    api(`/desks/grid?salon_id=${salon_id}&tarih=${tarih}&baslangic=${baslangic}&bitis=${bitis}`),
  create: (data) => api('/desk-reservations', { method: 'POST', body: JSON.stringify(data) }),
  my: () => api('/desk-reservations/my'),
  cancel: (id) => api(`/desk-reservations/${id}`, { method: 'DELETE' }),
  list: () => api('/desk-reservations'),
};

export const studyRoomsApi = {
  list: () => api('/study-rooms'),
  get: (id) => api(`/study-rooms/${id}`),
};

export const roomsApi = {
  list: () => api('/rooms'),
};

export const membersApi = {
  list: () => api('/members'),
  create: (data) => api('/members', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setPreferredBranch: (tercih_sube_id) => api('/members/me/branch', {
    method: 'PUT',
    body: JSON.stringify({ tercih_sube_id }),
  }),
};

export const staffApi = {
  meta: () => api('/staff/meta'),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/staff${q ? `?${q}` : ''}`);
  },
  get: (id) => api(`/staff/${id}`),
  create: (data) => api('/staff', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  listTasks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/staff-tasks${q ? `?${q}` : ''}`);
  },
  createTask: (data) => api('/staff-tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => api(`/staff-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const auditApi = {
  meta: () => api('/audit-logs/meta'),
  stats: () => api('/audit-logs/stats'),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/audit-logs${q ? `?${q}` : ''}`);
  },
};

export const cardApi = {
  get: () => api('/members/card'),
  updatePhoto: (profil_foto) => api('/members/photo', { method: 'PUT', body: JSON.stringify({ profil_foto }) }),
};

export const loansApi = {
  create: (data) => api('/loans', { method: 'POST', body: JSON.stringify(data) }),
  return: (id, data = {}) => api(`/loans/${id}/return`, { method: 'POST', body: JSON.stringify(data) }),
  extend: (id) => api(`/loans/${id}/extend`, { method: 'POST' }),
  active: () => api('/loans/active'),
  all: () => api('/loans/all'),
  my: () => api('/loans/my'),
  checkOverdue: () => api('/loans/check-overdue', { method: 'POST' }),
};

export const reservationsApi = {
  list: () => api('/reservations'),
  queue: (bookId) => api(`/reservations/queue/${bookId}`),
  create: (book_id) => api('/reservations', { method: 'POST', body: JSON.stringify({ book_id }) }),
  my: () => api('/reservations/my'),
  cancel: (id) => api(`/reservations/${id}`, { method: 'DELETE' }),
};

export const roomReservationsApi = {
  slots: (room_id, tarih) => api(`/room-reservations/slots?room_id=${room_id}&tarih=${tarih}`),
  create: (data) => api('/room-reservations', { method: 'POST', body: JSON.stringify(data) }),
  my: () => api('/room-reservations/my'),
  cancel: (id) => api(`/room-reservations/${id}`, { method: 'DELETE' }),
  list: () => api('/room-reservations'),
};

export const penaltiesApi = {
  list: () => api('/penalties'),
  my: () => api('/penalties/my'),
  get: (id) => api(`/penalties/${id}`),
  types: () => api('/penalties/types'),
  create: (data) => api('/penalties', { method: 'POST', body: JSON.stringify(data) }),
  pay: (id, data = {}) => api(`/penalties/${id}/pay`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id, aciklama) => api(`/penalties/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ aciklama }) }),
  discount: (id, data) => api(`/penalties/${id}/discount`, { method: 'PUT', body: JSON.stringify(data) }),
  installments: (id, data) => api(`/penalties/${id}/installments`, { method: 'PUT', body: JSON.stringify(data) }),
  note: (id, aciklama) => api(`/penalties/${id}/note`, { method: 'PUT', body: JSON.stringify({ aciklama }) }),
  uploadReceipt: (id, data) => api(`/penalties/${id}/receipt`, { method: 'POST', body: JSON.stringify(data) }),
  reviewReceipt: (id, data) => api(`/penalties/${id}/receipt/review`, { method: 'PUT', body: JSON.stringify(data) }),
  downloadReceipt: async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/penalties/${id}/receipt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Dekont indirilemedi');
    }
    return res.blob();
  },
  roomNoShow: (reservationId) => api(`/penalties/room-noshow/${reservationId}`, { method: 'POST' }),
};

export const reportsApi = {
  dashboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/reports/dashboard${q ? `?${q}` : ''}`);
  },
  analytics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/reports/analytics${q ? `?${q}` : ''}`);
  },
  types: () => api('/reports/types'),
  preview: (type, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/reports/preview/${type}${q ? `?${q}` : ''}`);
  },
  exportUrl: (type, format, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return `/api/reports/export/${type}/${format}${q ? `?${q}` : ''}`;
  },
};

export const purchaseRequestsApi = {
  meta: () => api('/purchase-requests/meta'),
  stats: () => api('/purchase-requests/stats'),
  mine: () => api('/purchase-requests/my'),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/purchase-requests${q ? `?${q}` : ''}`);
  },
  get: (id) => api(`/purchase-requests/${id}`),
  create: (data) => api('/purchase-requests', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, data) => api(`/purchase-requests/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id) => api(`/purchase-requests/${id}`, { method: 'DELETE' }),
};

export const donationsApi = {
  meta: () => api('/donations/meta'),
  stats: () => api('/donations/stats'),
  mine: () => api('/donations/my'),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/donations${q ? `?${q}` : ''}`);
  },
  get: (id) => api(`/donations/${id}`),
  create: (data) => api('/donations', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, data) => api(`/donations/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id) => api(`/donations/${id}`, { method: 'DELETE' }),
};

export const inventoryApi = {
  rafs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/inventory/rafs${q ? `?${q}` : ''}`);
  },
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/inventory/sessions${q ? `?${q}` : ''}`);
  },
  create: (data) => api('/inventory/sessions', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => api(`/inventory/sessions/${id}`),
  report: (id) => api(`/inventory/sessions/${id}/report`),
  scan: (id, code) => api(`/inventory/sessions/${id}/scan`, { method: 'POST', body: JSON.stringify({ code }) }),
  complete: (id) => api(`/inventory/sessions/${id}/complete`, { method: 'PUT' }),
  cancel: (id) => api(`/inventory/sessions/${id}/cancel`, { method: 'PUT' }),
};

export const branchesApi = {
  list: () => api('/branches'),
  stats: (id) => api(`/branches/${id}/stats`),
  update: (id, data) => api(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const transfersApi = {
  flow: () => api('/transfers/flow'),
  create: (data) => api('/transfers', { method: 'POST', body: JSON.stringify(data) }),
  my: () => api('/transfers/my'),
  list: (durum) => api(`/transfers${durum ? `?durum=${durum}` : ''}`),
  setStatus: (id, durum) => api(`/transfers/${id}/status`, { method: 'PUT', body: JSON.stringify({ durum }) }),
  cancel: (id) => api(`/transfers/${id}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/notifications${q ? `?${q}` : ''}`);
  },
  types: () => api('/notifications/types'),
  preferences: () => api('/notifications/preferences'),
  updatePreferences: (preferences) => api('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify({ preferences }),
  }),
  deliveries: () => api('/notifications/deliveries'),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => api('/notifications/read-all', { method: 'PUT' }),
  announce: (data) => api('/notifications/announce', { method: 'POST', body: JSON.stringify(data) }),
};

export const scanApi = {
  lookup: (code) => api('/scan/lookup', { method: 'POST', body: JSON.stringify({ code }) }),
  lend: (member_code, copy_code) => api('/scan/lend', { method: 'POST', body: JSON.stringify({ member_code, copy_code }) }),
  return: (copy_code, data = {}) => api('/scan/return', { method: 'POST', body: JSON.stringify({ copy_code, ...data }) }),
  damage: (copy_code, aciklama) => api('/scan/damage', { method: 'POST', body: JSON.stringify({ copy_code, aciklama }) }),
};

export const returnInspectionsApi = {
  conditions: () => api('/return-inspections/conditions'),
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/return-inspections${q ? `?${q}` : ''}`);
  },
  photo: async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/return-inspections/${id}/photo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Fotoğraf yüklenemedi');
    return res.blob();
  },
};

export const shelfApi = {
  list: () => api('/shelf'),
  move: (book_id, raf_no) => api('/shelf/move', { method: 'PUT', body: JSON.stringify({ book_id, raf_no }) }),
};

export const clubApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/clubs${q ? `?${q}` : ''}`);
  },
  stats: () => api('/clubs/stats'),
  get: (id) => api(`/clubs/${id}`),
  create: (data) => api('/clubs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/clubs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  join: (id) => api(`/clubs/${id}/join`, { method: 'POST' }),
  leave: (id) => api(`/clubs/${id}/leave`, { method: 'POST' }),
  setMonthlyBook: (id, book_id, notlar) => api(`/clubs/${id}/monthly-book`, { method: 'POST', body: JSON.stringify({ book_id, notlar }) }),
  getMonthlyBooks: (id) => api(`/clubs/${id}/monthly-books`),
  createMeeting: (id, data) => api(`/clubs/${id}/meetings`, { method: 'POST', body: JSON.stringify(data) }),
  updateMeeting: (id, data) => api(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getDiscussions: (id) => api(`/clubs/${id}/discussions`),
  addDiscussion: (id, data) => api(`/clubs/${id}/discussions`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDiscussion: (id) => api(`/discussions/${id}`, { method: 'DELETE' }),
};
