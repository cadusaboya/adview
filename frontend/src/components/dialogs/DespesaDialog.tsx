'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
import { getBancos } from '@/services/bancos';
import { getFuncionarios, Funcionario } from '@/services/funcionarios';
import { Despesa } from '@/services/despesas';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  despesa?: Despesa | null;
}

export default function DespesaDialog({
  open,
  onClose,
  onSubmit,
  despesa,
}: Props) {
  const [formData, setFormData] = useState<any>({
    nome: '',
    descricao: '',
    responsavel_id: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
  });

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  /* 🔹 Preencher formulário ao editar */
  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome || '',
        descricao: despesa.descricao || '',
        responsavel_id: despesa.responsavel?.id
          ? String(despesa.responsavel.id)
          : '',
        valor: despesa.valor || '',
        data_vencimento: despesa.data_vencimento || '',
        tipo: despesa.tipo || '',
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel_id: '',
        valor: '',
        data_vencimento: '',
        tipo: '',
      });
    }
  }, [despesa, open]);

  /* 🔹 Carregar bancos */
  useEffect(() => {
    const loadBancos = async () => {
      const { results } = await getBancos({ page_size: 1000 });
      setBancos(results.map((b) => ({ id: b.id, nome: b.nome })));
    };
    loadBancos();
  }, []);

  /* 🔹 Carregar funcionários (favorecidos) */
  useEffect(() => {
    const loadFuncionarios = async () => {
      try {
        const { results } = await getFuncionarios({ page_size: 1000 });
        setFuncionarios(results);
      } catch (error) {
        console.error('Erro ao carregar funcionários', error);
      }
    };
    loadFuncionarios();
  }, []);

  const handleSubmit = async () => {
    const payload = { ...formData };
    await onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={despesa ? 'Editar Despesa' : 'Nova Despesa'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Favorecido + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ✅ COMBOBOX DE FAVORECIDO */}
          <div>
            <label className="text-sm">Favorecido</label>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {formData.responsavel_id
                    ? funcionarios.find(
                        (f) => String(f.id) === formData.responsavel_id
                      )?.nome
                    : 'Selecione um favorecido'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                align="start"
                side="bottom"
                sideOffset={4}
                className="w-[--radix-popover-trigger-width] p-0 rounded-md border shadow-md"
              >
                <Command>
                  <CommandInput placeholder="Buscar favorecido..." />
                  <CommandEmpty>Nenhum favorecido encontrado.</CommandEmpty>

                  <CommandGroup>
                    {funcionarios.map((func) => (
                      <CommandItem
                        key={func.id}
                        value={func.nome}
                        onSelect={() =>
                          setFormData({
                            ...formData,
                            responsavel_id: String(func.id),
                          })
                        }
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            formData.responsavel_id === String(func.id)
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        {func.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome da despesa"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>
        </div>

        {/* 🔸 Descrição */}
        <div>
          <label className="text-sm">Descrição</label>
          <Input
            placeholder="Descrição ou observações"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* 🔸 Valor + Vencimento + Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Valor (R$)</label>
            <Input
              type="number"
              placeholder="Ex.: 1500"
              value={formData.valor}
              onChange={(e) =>
                setFormData({ ...formData, valor: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">Data de Vencimento</label>
            <Input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  data_vencimento: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Fixa</SelectItem>
                <SelectItem value="V">Variável</SelectItem>
                <SelectItem value="C">Comissão</SelectItem>
                <SelectItem value="R">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔥 Pagamentos */}
        {despesa && (
          <PaymentsTabs
            tipo="despesa"
            entityId={despesa.id}
            contasBancarias={bancos}
          />
        )}
      </div>
    </DialogBase>
  );
}
