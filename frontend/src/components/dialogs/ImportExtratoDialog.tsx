'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet } from 'lucide-react';

import { getBancos } from '@/services/bancos';
import { importExtrato, ImportExtratoResponse } from '@/services/payments';

import { Banco } from '@/types/bancos';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportExtratoDialog({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [selectedBanco, setSelectedBanco] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // ======================
  // 🔹 LOAD BANCOS
  // ======================
  useEffect(() => {
    if (open) {
      loadBancos();
    }
  }, [open]);

  const loadBancos = async () => {
    try {
      const data = await getBancos({});
      setBancos(data.results);
    } catch (error) {
      console.error('Erro ao carregar bancos:', error);
      toast.error('Erro ao carregar contas bancárias');
    }
  };

  // ======================
  // 📁 FILE SELECTION
  // ======================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Valida se é um arquivo XLSX
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
        return;
      }
      setSelectedFile(file);
    }
  };

  // ======================
  // 📤 SUBMIT
  // ======================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error('Por favor, selecione um arquivo');
      return;
    }

    if (!selectedBanco) {
      toast.error('Por favor, selecione uma conta bancária');
      return;
    }

    try {
      setLoading(true);

      const result: ImportExtratoResponse = await importExtrato(
        selectedFile,
        selectedBanco
      );

      if (result.success) {
        let message = `${result.created_count} pagamento(s) importado(s) com sucesso para ${result.conta_bancaria}!`;

        if (result.saldo_inicial && result.saldo_final) {
          message += `\n\n📊 Resumo Financeiro:`;
          message += `\n• Saldo inicial: R$ ${result.saldo_inicial}`;
          message += `\n• Total entradas: R$ ${result.total_entradas || '0.00'}`;
          message += `\n• Total saídas: R$ ${result.total_saidas || '0.00'}`;
          message += `\n• Saldo esperado: R$ ${result.saldo_esperado || result.saldo_final}`;
          message += `\n• Saldo final: R$ ${result.saldo_final}`;

          if (result.diferenca && result.diferenca !== '0.00') {
            message += `\n\n⚠️ Diferença: R$ ${result.diferenca}`;
          }
        }

        if (result.errors && result.errors.length > 0) {
          message += `\n\nAvisos (${result.total_errors || result.errors.length}):\n`;
          message += result.errors.slice(0, 5).join('\n');
          if ((result.total_errors || 0) > 5) {
            message += `\n... e mais ${(result.total_errors || 0) - 5} avisos`;
          }
        }

        toast.success(message, { duration: 10000 });
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      console.error('Erro ao importar extrato:', error);

      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao importar extrato';

      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 🚪 CLOSE
  // ======================
  const handleClose = () => {
    setSelectedFile(null);
    setSelectedBanco(null);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={handleClose}
      title="Importar Extrato Bancário"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CONTA BANCÁRIA */}
        <div className="space-y-2">
          <Label htmlFor="banco">Conta Bancária *</Label>
          <Select
            value={selectedBanco?.toString() || ''}
            onValueChange={(value) => setSelectedBanco(Number(value))}
          >
            <SelectTrigger id="banco">
              <SelectValue placeholder="Selecione a conta bancária" />
            </SelectTrigger>
            <SelectContent>
              {bancos.map((banco) => (
                <SelectItem key={banco.id} value={String(banco.id)}>
                  {banco.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* FILE UPLOAD */}
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo do Extrato (XLSX) *</Label>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="relative overflow-hidden"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {selectedFile ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </Button>

            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="truncate max-w-xs">{selectedFile.name}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Arquivo do extrato bancário do BTG em formato Excel (.xlsx)
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>

          <Button type="submit" disabled={loading || !selectedFile || !selectedBanco}>
            {loading ? 'Importando...' : 'Importar'}
          </Button>
        </div>
      </form>
    </DialogBase>
  );
}
