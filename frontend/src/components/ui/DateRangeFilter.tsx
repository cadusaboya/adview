'use client';

import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import ptBR from 'antd/es/date-picker/locale/pt_BR';

dayjs.locale('pt-br');

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
    <div className="flex items-center gap-2">
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground mb-1">{labelStart}</span>
        <DatePicker
          locale={ptBR}
          format="DD/MM/YYYY"
          placeholder="dd/mm/aaaa"
          value={parseDate(startDate)}
          onChange={(d) =>
            onChange(d ? d.format('YYYY-MM-DD') : undefined, endDate)
          }
          allowClear
        />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground mb-1">{labelEnd}</span>
        <DatePicker
          locale={ptBR}
          format="DD/MM/YYYY"
          placeholder="dd/mm/aaaa"
          value={parseDate(endDate)}
          onChange={(d) =>
            onChange(startDate, d ? d.format('YYYY-MM-DD') : undefined)
          }
          allowClear
        />
      </div>
    </div>
  );
}
