'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import ConfirmDuplicatesDialog from '@/components/dialogs/ConfirmDuplicatesDialog';
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
import { importExtrato, ImportExtratoResponse, PotentialDuplicate } from '@/services/payments';

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

  // Estados para confirmação de duplicatas
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([]);

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
  const handleSubmit = async (e: React.FormEvent, forceImportLines?: number[]) => {
    e?.preventDefault();

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
        selectedBanco,
        forceImportLines
      );

      // Se requer confirmação, mostra diálogo de duplicatas
      if (result.requires_confirmation && result.potential_duplicates) {
        setPotentialDuplicates(result.potential_duplicates);
        setShowConfirmDialog(true);
        return;
      }

      if (result.success) {
        let message = `${result.created_count} pagamento(s) importado(s) com sucesso!`;

        // Mostra informação sobre pagamentos ignorados (duplicatas)
        if (result.skipped_count && result.skipped_count > 0) {
          message += `\n${result.skipped_count} pagamento(s) ignorado(s) (duplicatas)`;
        }

        // Mostra apenas avisos importantes
        if (result.errors && result.errors.length > 0) {
          const warningCount = result.total_errors || result.errors.length;
          message += `\n\n⚠️ ${warningCount} aviso(s)`;
        }

        toast.success(message, { duration: 5000 });
        onSuccess();
        handleClose();
      }
    } catch (error: unknown) {
      console.error('Erro ao importar extrato:', error);

      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (error as { message?: string })?.message ||
        'Erro ao importar extrato';

      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 🔄 CONFIRMAÇÃO DE DUPLICATAS
  // ======================
  const handleConfirmDuplicates = async (selectedLines: number[]) => {
    setShowConfirmDialog(false);

    if (!selectedFile || !selectedBanco) return;

    try {
      setLoading(true);

      // Segunda passagem: envia com confirmed=true e as linhas selecionadas
      const result: ImportExtratoResponse = await importExtrato(
        selectedFile,
        selectedBanco,
        selectedLines,
        true  // confirmed=true
      );

      if (result.success) {
        let message = `${result.created_count} pagamento(s) importado(s) com sucesso!`;

        if (result.skipped_count && result.skipped_count > 0) {
          message += `\n${result.skipped_count} pagamento(s) ignorado(s) (duplicatas)`;
        }

        if (result.errors && result.errors.length > 0) {
          const warningCount = result.total_errors || result.errors.length;
          message += `\n\n⚠️ ${warningCount} aviso(s)`;
        }

        toast.success(message, { duration: 5000 });
        onSuccess();
        handleClose();
      }
    } catch (error: unknown) {
      console.error('Erro ao importar extrato:', error);

      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (error as { message?: string })?.message ||
        'Erro ao importar extrato';

      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDuplicates = () => {
    setShowConfirmDialog(false);
    setPotentialDuplicates([]);
    toast.info('Importação cancelada');
  };

  // ======================
  // 🚪 CLOSE
  // ======================
  const handleClose = () => {
    setSelectedFile(null);
    setSelectedBanco(null);
    setShowConfirmDialog(false);
    setPotentialDuplicates([]);
    onClose();
  };

  return (
    <>
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

      {/* Diálogo de confirmação de duplicatas */}
      <ConfirmDuplicatesDialog
        open={showConfirmDialog}
        duplicates={potentialDuplicates}
        onConfirm={handleConfirmDuplicates}
        onCancel={handleCancelDuplicates}
      />
    </>
  );
}
