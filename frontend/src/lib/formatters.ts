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

/* ======================
   📄 CPF/CNPJ – EXIBIÇÃO
====================== */
export function formatCpfCnpj(value?: string | null) {
  if (!value) return '—';

  // Remove tudo que não é dígito
  const numbers = value.replace(/\D/g, '');

  // CPF: 000.000.000-00 (11 dígitos)
  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // CNPJ: 00.000.000/0000-00 (14 dígitos)
  if (numbers.length === 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  // Se não for CPF nem CNPJ válido, retorna como está
  return value;
}
