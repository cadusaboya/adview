import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { gerarRelatorioPDF } from '@/services/pdf';

interface PaymentItem {
  id: number;
  data_pagamento: string;
  observacao?: string;
  conta_bancaria: number | string;
  valor: number;
}

export default function PaymentsTable({
  payments,
  contasBancarias,
  onDelete,
}: {
  payments: PaymentItem[];
  contasBancarias: { id: number; nome: string }[];
  onDelete: (id: number) => void;
}) {
  const [loadingRecibo, setLoadingRecibo] = useState<number | null>(null);

  const handleGerarRecibo = async (paymentId: number) => {
    try {
      setLoadingRecibo(paymentId);
      await gerarRelatorioPDF('recibo-pagamento', { payment_id: paymentId });
      toast.success('Recibo gerado com sucesso!');
    } catch (error: unknown) {
      console.error(error);
    
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao gerar recibo');
      }
    }
     finally {
      setLoadingRecibo(null);
    }
  };

  return (
    <div className="border rounded-md shadow-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Obs.</TableHead>
            <TableHead>Conta</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{formatDateBR(p.data_pagamento)}</TableCell>
              <TableCell>{p.observacao || '—'}</TableCell>
              <TableCell>
                {contasBancarias.find((c) => String(c.id) === String(p.conta_bancaria))?.nome ||
                  'Conta não encontrada'}
              </TableCell>
              <TableCell>{formatCurrencyBR(p.valor)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGerarRecibo(p.id)}
                    loading={loadingRecibo === p.id}
                    title="Gerar Recibo"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(p.id)}
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {payments.length === 0 && (
        <div className="text-sm text-muted-foreground p-4">Nenhum pagamento registrado.</div>
      )}
    </div>
  );
}
