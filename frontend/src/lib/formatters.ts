// src/lib/formatters.ts

/* ======================
   📅 DATAS (exibição)
====================== */
export function formatDateBR(date?: string | null) {
  if (!date) return '—';

  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;

  return `${day}/${month}/${year}`;
}

/* ======================
   💰 MOEDA – EXIBIÇÃO
====================== */
export function formatCurrencyBR(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);
  if (isNaN(number)) return '—';

  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ======================
   💰 MOEDA – INPUT
====================== */
export function formatCurrencyInput(value: number | string) {
  if (value === '' || value === null || value === undefined) return '';

  const number = Number(value);
  if (isNaN(number)) return '';

  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ======================
   💰 MOEDA – BACKEND
====================== */
export function parseCurrencyBR(value: string) {
  if (!value) return 0;

  return Number(
    value.replace(/\./g, '').replace(',', '.')
  );
}
