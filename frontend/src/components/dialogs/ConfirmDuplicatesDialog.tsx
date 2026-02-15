'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PotentialDuplicate } from '@/services/payments';

interface Props {
  open: boolean;
  duplicates: PotentialDuplicate[];
  onConfirm: (selectedLines: number[]) => void;
  onCancel: () => void;
}

export default function ConfirmDuplicatesDialog({
  open,
  duplicates,
  onConfirm,
  onCancel,
}: Props) {
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());

  const handleToggle = (lineIndex: number) => {
    setSelectedLines((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lineIndex)) {
        newSet.delete(lineIndex);
      } else {
        newSet.add(lineIndex);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedLines(new Set(duplicates.map((d) => d.line_index)));
  };

  const handleDeselectAll = () => {
    setSelectedLines(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedLines));
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-5xl max-h-[90vh] min-h-[60vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Possíveis Duplicatas Encontradas</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-muted-foreground">
            Foram encontrados {duplicates.length} pagamento(s) com mesma data e valor, mas observações diferentes.
            Selecione quais você deseja importar mesmo assim:
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
              Selecionar Todos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
              Desmarcar Todos
            </Button>
          </div>

          <div className="space-y-4">
            {duplicates.map((duplicate) => (
              <div key={duplicate.line_index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`duplicate-${duplicate.line_index}`}
                    checked={selectedLines.has(duplicate.line_index)}
                    onCheckedChange={() => handleToggle(duplicate.line_index)}
                  />
                  <label htmlFor={`duplicate-${duplicate.line_index}`} className="flex-1 cursor-pointer">
                    <div className="font-medium mb-2">Linha {duplicate.line_index}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="border-l-4 border-amber-500 pl-3">
                        <div className="font-semibold text-amber-700 mb-2">Pagamento Existente</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div><span className="font-medium">Data:</span> {formatDate(duplicate.existing_payment.data)}</div>
                          <div><span className="font-medium">Valor:</span> {formatCurrency(duplicate.existing_payment.valor)}</div>
                          <div><span className="font-medium">Tipo:</span> {duplicate.existing_payment.tipo === 'E' ? 'Entrada' : 'Saída'}</div>
                          <div><span className="font-medium">Banco:</span> {duplicate.existing_payment.banco}</div>
                          <div><span className="font-medium">Observação:</span> <span className="italic">{duplicate.existing_payment.observacao || '(vazio)'}</span></div>
                        </div>
                      </div>
                      <div className="border-l-4 border-blue-500 pl-3">
                        <div className="font-semibold text-blue-700 mb-2">Novo Pagamento (a importar)</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div><span className="font-medium">Data:</span> {formatDate(duplicate.new_payment.data)}</div>
                          <div><span className="font-medium">Valor:</span> {formatCurrency(duplicate.new_payment.valor)}</div>
                          <div><span className="font-medium">Tipo:</span> {duplicate.new_payment.tipo === 'E' ? 'Entrada' : 'Saída'}</div>
                          <div><span className="font-medium">Banco:</span> {duplicate.new_payment.banco}</div>
                          <div><span className="font-medium">Observação:</span> <span className="italic">{duplicate.new_payment.observacao || '(vazio)'}</span></div>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-6">
          <div className="text-sm text-muted-foreground mr-auto self-center">
            {selectedLines.size} de {duplicates.length} selecionado(s) para importar
          </div>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar Importação
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Importar Selecionados ({selectedLines.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
