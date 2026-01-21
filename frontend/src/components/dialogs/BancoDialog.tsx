'use client';

import DialogBase from '@/components/dialogs/DialogBase';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Banco } from '@/services/bancos';

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

export default function BancoDialog({
  open,
  onClose,
  onSubmit,
  banco,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Banco) => void;
  banco?: Banco | null;
}) {
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    saldo_inicial: 0, // 🔹 valor REAL
  });

  const [saldoDisplay, setSaldoDisplay] = useState('');

  /* 🔹 Preenche os campos quando edita */
  useEffect(() => {
    if (banco) {
      setFormData({
        nome: banco.nome || '',
        descricao: banco.descricao || '',
        saldo_inicial: banco.saldo_inicial
          ? Number(banco.saldo_inicial)
          : 0,
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

  const handleSubmit = () => {
    const payload = {
      nome: formData.nome,
      descricao: formData.descricao,
      saldo_inicial: formData.saldo_inicial, // 🔥 número limpo
    };

    onSubmit(payload);
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
