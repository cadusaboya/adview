interface Props {
    status: 'P' | 'A' | 'V';
    label?: string;
  }
  
  export default function StatusBadge({ status, label }: Props) {
    const config = {
      P: {
        text: label || 'Paga',
        className: 'bg-green-100 text-green-700 border-green-300',
      },
      A: {
        text: label || 'Em aberto',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      },
      V: {
        text: label || 'Vencida',
        className: 'bg-red-100 text-red-700 border-red-300',
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
  