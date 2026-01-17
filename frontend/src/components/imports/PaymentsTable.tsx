import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatDateBR } from '@/lib/formatters';

export default function PaymentsTable({
  payments,
  contasBancarias,
  onDelete,
}: {
  payments: PaymentItem[];
  contasBancarias: { id: number; nome: string }[];
  onDelete: (id: number) => void;
}) {
  return (
    <div className="border rounded-md shadow-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Obs.</TableHead>
            <TableHead>Conta</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="w-10"></TableHead>
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
              <TableCell>R$ {Number(p.valor).toFixed(2)}</TableCell>
              <TableCell>
                <Button variant="destructive" size="sm" onClick={() => onDelete(p.id)}>
                  Excluir
                </Button>
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
