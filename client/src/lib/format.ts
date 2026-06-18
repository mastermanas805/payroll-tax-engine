// Formatting helpers. Money columns are right-aligned monospaced; amounts come
// from the API as plain 2-decimal numbers (already rounded per ruleset) — the
// UI only formats for display, it never does monetary math.

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? '';
}

/** Group-separated 2-decimal money, no symbol (symbol shown in column header). */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

/** Money with currency symbol prefix, for hero/summary figures. */
export function formatMoneyWithSymbol(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${formatMoney(amount)}`;
}

/** Render a YYYY-MM period as e.g. "June 2025". */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) return period;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Short date for table cells. */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Current period as YYYY-MM. */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
