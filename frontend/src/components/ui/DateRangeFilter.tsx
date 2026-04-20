'use client';

import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import ptBR from 'antd/es/date-picker/locale/pt_BR';

dayjs.locale('pt-br');

const { RangePicker } = DatePicker;

interface DateRangeFilterProps {
  startDate?: string;
  endDate?: string;
  onChange: (start: string | undefined, end: string | undefined) => void;
  labelStart?: string;
  labelEnd?: string;
}

/**
 * Filtro de intervalo de datas (De / Até) em formato BR.
 * Emite as datas em formato ISO (YYYY-MM-DD) para envio ao backend.
 */
export default function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  labelStart = 'De',
  labelEnd = 'Até',
}: DateRangeFilterProps) {
  const parseDate = (iso?: string): Dayjs | null => {
    if (!iso) return null;
    const d = dayjs(iso, 'YYYY-MM-DD');
    return d.isValid() ? d : null;
  };

  return (
    <RangePicker
      locale={ptBR}
      format="DD/MM/YYYY"
      placeholder={[labelStart, labelEnd]}
      value={[parseDate(startDate), parseDate(endDate)]}
      onChange={(dates) => {
        const start = dates?.[0] ? dates[0].format('YYYY-MM-DD') : undefined;
        const end = dates?.[1] ? dates[1].format('YYYY-MM-DD') : undefined;
        onChange(start, end);
      }}
      allowEmpty={[true, true]}
      allowClear
    />
  );
}
