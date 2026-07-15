import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { reportsApi } from '../../api';
import { adminNav } from '../../constants/adminNav';
import { useT, useLocale } from '../../i18n/LocaleContext';

const FORMAT_OPTIONS = [
  { id: 'pdf', label: 'PDF', icon: '📄', color: 'red' },
  { id: 'excel', label: 'Excel', icon: '📊', color: 'green' },
  { id: 'csv', label: 'CSV', icon: '📋', color: 'blue' },
];

const REPORT_ICONS = {
  daily_loans: '📅',
  overdue_books: '⏰',
  penalties: '💰',
  inventory: '📦',
  user_activity: '👤',
  branch_performance: '🏢',
  book_usage: '📚',
};

export default function ReportExport() {
  const t = useT();
  const { locale } = useLocale();
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    reportsApi.types().then(setReportTypes).catch(console.error);
  }, []);

  const handlePreview = async () => {
    if (!selectedType) return;
    setLoading(true);
    setPreview(null);
    try {
      const data = await reportsApi.preview(selectedType, filters);
      setPreview(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleExport = async (format) => {
    if (!selectedType) return;
    setExporting(format);
    try {
      const token = localStorage.getItem('token');
      const url = reportsApi.exportUrl(selectedType, format, filters);
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const ext = format === 'excel' ? 'xlsx' : format;
      a.download = `rapor_${selectedType}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
    }
    setExporting('');
  };

  const handlePrint = () => window.print();

  const reportTypeLabels = {
    daily_loans: t('reports.dailyLoans'),
    overdue_books: t('reports.overdueBooks'),
    penalties: t('reports.penalties'),
    inventory: t('reports.inventory'),
    user_activity: t('reports.userActivity'),
    branch_performance: t('reports.branchPerformance'),
    book_usage: t('reports.bookUsage'),
  };

  return (
    <Layout navItems={adminNav} titleKey="nav.admin.reportExport">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('reports.exportTitle')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('reports.exportSubtitle')}</p>
          </div>
          {preview && (
            <button onClick={handlePrint} className="bg-gray-600 hover:bg-gray-500 text-white rounded-lg px-4 py-2 text-sm print:hidden">
              🖨️ {t('reports.print')}
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-6 print:hidden">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('reports.selectType')}</h3>
              <div className="space-y-1.5">
                {reportTypes.map((rt) => (
                  <button
                    key={rt.id}
                    onClick={() => { setSelectedType(rt.id); setPreview(null); }}
                    className={`w-full text-start px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      selectedType === rt.id
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <span>{REPORT_ICONS[rt.id] || '📋'}</span>
                    <span>{reportTypeLabels[rt.id] || rt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedType && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('reports.filters')}</h3>
                {selectedType === 'daily_loans' && (
                  <div>
                    <label className="text-xs text-gray-400">{t('reports.date')}</label>
                    <input
                      type="date"
                      value={filters.date}
                      onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                    />
                  </div>
                )}
                {selectedType === 'penalties' && (
                  <div>
                    <label className="text-xs text-gray-400">{t('reports.penaltyStatus')}</label>
                    <select
                      value={filters.durum || ''}
                      onChange={(e) => setFilters({ ...filters, durum: e.target.value || undefined })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                    >
                      <option value="">{t('common.all')}</option>
                      <option value="odenmedi">{t('reports.unpaid')}</option>
                      <option value="odendi">{t('reports.paid')}</option>
                    </select>
                  </div>
                )}
                <button
                  onClick={handlePreview}
                  disabled={loading}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? t('common.loading') : t('reports.preview')}
                </button>
              </div>
            )}

            {selectedType && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('reports.exportAs')}</h3>
                <div className="space-y-2">
                  {FORMAT_OPTIONS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => handleExport(fmt.id)}
                      disabled={!!exporting}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50 ${
                        fmt.color === 'red'
                          ? 'bg-red-600/10 text-red-400 border-red-500/20 hover:bg-red-600/20'
                          : fmt.color === 'green'
                          ? 'bg-green-600/10 text-green-400 border-green-500/20 hover:bg-green-600/20'
                          : 'bg-blue-600/10 text-blue-400 border-blue-500/20 hover:bg-blue-600/20'
                      }`}
                    >
                      <span className="text-lg">{fmt.icon}</span>
                      <span>{exporting === fmt.id ? t('reports.exporting') : `${t('reports.download')} ${fmt.label}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            {!selectedType && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <span className="text-6xl block mb-4">📊</span>
                <h3 className="text-lg font-semibold text-white mb-2">{t('reports.selectPromptTitle')}</h3>
                <p className="text-gray-400 text-sm">{t('reports.selectPromptDesc')}</p>
              </div>
            )}

            {selectedType && !preview && !loading && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <span className="text-5xl block mb-4">{REPORT_ICONS[selectedType] || '📋'}</span>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {reportTypeLabels[selectedType]}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{t('reports.clickPreview')}</p>
              </div>
            )}

            {loading && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">{t('reports.generating')}</p>
              </div>
            )}

            {preview && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden" id="report-print-area">
                <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{preview.title}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {t('reports.totalRecords', { count: preview.rows.length })} — {new Date().toLocaleString(locale === 'ar' ? 'ar-SA' : locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-US' : 'tr-TR')}
                    </p>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    {FORMAT_OPTIONS.map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => handleExport(fmt.id)}
                        disabled={!!exporting}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {fmt.icon} {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700/50">
                      <tr>
                        {preview.columns.map((col, i) => (
                          <th key={i} className="px-4 py-2.5 text-start text-gray-400 font-medium text-xs whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {preview.rows.length === 0 ? (
                        <tr>
                          <td colSpan={preview.columns.length} className="px-4 py-8 text-center text-gray-500">
                            {t('reports.noData')}
                          </td>
                        </tr>
                      ) : (
                        preview.rows.slice(0, 100).map((row, ri) => (
                          <tr key={ri} className="hover:bg-gray-700/20">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-4 py-2 text-gray-300 text-xs whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {preview.rows.length > 100 && (
                    <div className="px-4 py-3 text-center text-gray-500 text-xs border-t border-gray-700">
                      {t('reports.showingFirst', { count: 100, total: preview.rows.length })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
