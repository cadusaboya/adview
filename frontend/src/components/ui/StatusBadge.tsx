interface Props {
    status: 'P' | 'A' | 'V';
    label?: string;
  }

  export default function StatusBadge({ status, label }: Props) {
    const config = {
      P: {
        text: label || 'Paga',
        className: 'bg-success/10 text-success border-success',
      },
      A: {
        text: label || 'Em aberto',
        className: 'bg-warning/10 text-warning border-warning',
      },
      V: {
        text: label || 'Vencida',
        className: 'bg-danger/10 text-danger border-danger',
      },
    }[status];

    return (
      <span
        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${config.className}`}
      >
        {config.text}
      </span>
    );
  }
  