'use client';

import DialogBase from '@/components/dialogs/DialogBase';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

import { Banco, BancoCreate, BancoUpdate } from '@/types/bancos';

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

interface BancoDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BancoCreate | BancoUpdate) => void;
  banco?: Banco | null;
}

export default function BancoDialog({
  open,
  onClose,
  onSubmit,
  banco,
}: BancoDialogProps) {
  // 🔹 Form SEMPRE usa BancoCreate
  const [formData, setFormData] = useState<BancoCreate>({
    nome: '',
    descricao: '',
    saldo_inicial: 0,
  });

  const [saldoDisplay, setSaldoDisplay] = useState('');

  // ======================
  // 🔄 Preencher ao editar
  // ======================
  useEffect(() => {
    if (banco) {
      setFormData({
        nome: banco.nome,
        descricao: banco.descricao,
        saldo_inicial: banco.saldo_inicial,
      });

      setSaldoDisplay(
        banco.saldo_inicial
          ? formatCurrencyInput(banco.saldo_inicial)
          : ''
      );
    } else {
      setFormData({
        nome: '',
        descricao: '',
        saldo_inicial: 0,
      });

      setSaldoDisplay('');
    }
  }, [banco, open]);

  // ======================
  // 💾 Submit
  // ======================
  const handleSubmit = () => {
    if (banco) {
      // UPDATE → parcial permitido
      const payload: BancoUpdate = {
        nome: formData.nome,
        descricao: formData.descricao,
        saldo_inicial: formData.saldo_inicial,
      };

      onSubmit(payload);
    } else {
      // CREATE → payload completo
      const payload: BancoCreate = {
        nome: formData.nome,
        descricao: formData.descricao,
        saldo_inicial: formData.saldo_inicial,
      };

      onSubmit(payload);
    }

    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={banco ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-6">
        {/* 🔹 Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium block">Nome da Conta</label>
            <Input
              placeholder="Ex.: Itaú PJ, Nubank, Caixa"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium block">Saldo Inicial</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={saldoDisplay}
              onChange={(e) => {
                setSaldoDisplay(e.target.value);
              }}
              onFocus={() => {
                setSaldoDisplay(
                  saldoDisplay.replace(/[^\d,]/g, '')
                );
              }}
              onBlur={() => {
                const parsed = parseCurrencyBR(saldoDisplay);

                setSaldoDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );

                setFormData((prev) => ({
                  ...prev,
                  saldo_inicial: parsed,
                }));
              }}
            />
          </div>
        </div>

        {/* 🔹 Linha 2 */}
        <div className="space-y-1">
          <label className="text-sm font-medium block">Descrição</label>
          <Input
            placeholder="Ex.: Conta PJ usada para despesas fixas"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>
      </div>
    </DialogBase>
  );
}
