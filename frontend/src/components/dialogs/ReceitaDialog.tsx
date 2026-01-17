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
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';
import PaymentsTabs from '@/components/imports/PaymentsTabs';

import { getBancos } from '@/services/bancos';
import { getFuncionarios, Funcionario } from '@/services/funcionarios';
import { getClientes, Cliente } from '@/services/clientes';


interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  receita?: any | null;
}

export default function ReceitaDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [formData, setFormData] = useState<any>({
    nome: '',
    descricao: '',
    cliente_id: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
    forma_pagamento: '',
    comissionado_id: '',
  });

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [valorDisplay, setValorDisplay] = useState('');


  /* 🔹 Preencher formulário ao editar */
  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome || '',
        descricao: receita.descricao || '',
        cliente_id: receita.cliente_id ? String(receita.cliente_id) : '',
        valor: receita.valor || '',
        data_vencimento: receita.data_vencimento || '',
        tipo: receita.tipo || '',
        forma_pagamento: receita.forma_pagamento || '',
        comissionado_id: receita.comissionado_id
          ? String(receita.comissionado_id)
          : '',
      });
  
      setValorDisplay(
        receita.valor ? formatCurrencyInput(receita.valor) : ''
      );
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: '',
        valor: '',
        data_vencimento: '',
        tipo: '',
        forma_pagamento: '',
        comissionado_id: '',
      });
  
      setValorDisplay('');
    }
  }, [receita, open]);
  

  /* 🔹 Carregar bancos */
  useEffect(() => {
    const loadBancos = async () => {
      const { results } = await getBancos({ page_size: 1000 });
      setBancos(results.map((banco) => ({ id: banco.id, nome: banco.nome })));
    };
    loadBancos();
  }, []);

  /* 🔹 Carregar funcionários (comissionados) */
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

  useEffect(() => {
    const loadClientes = async () => {
      try {
        const { results } = await getClientes({ page_size: 1000 });
        setClientes(results);
      } catch (error) {
        console.error('Erro ao carregar clientes', error);
      }
    };
    loadClientes();
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
      title={receita ? 'Editar Receita' : 'Nova Receita'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Cliente + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
          <label className="text-sm">Cliente</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                {formData.cliente_id
                  ? clientes.find(
                      (c) => String(c.id) === formData.cliente_id
                    )?.nome
                  : 'Selecione um cliente'}
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
                <CommandInput placeholder="Buscar cliente..." />
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>

                <CommandGroup>
                  {clientes.map((cliente) => (
                    <CommandItem
                      key={cliente.id}
                      value={cliente.nome}
                      onSelect={() =>
                        setFormData({
                          ...formData,
                          cliente_id: String(cliente.id),
                        })
                      }
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          formData.cliente_id === String(cliente.id)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {cliente.nome}
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
              placeholder="Nome"
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
            placeholder="Observações ou descrição"
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
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorDisplay}

              onChange={(e) => {
                // NÃO formatar aqui
                setValorDisplay(e.target.value);
              }}

              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);

                // formata SOMENTE ao sair
                setValorDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );

                setFormData({ ...formData, valor: parsed });
              }}

              onFocus={() => {
                // remove pontos ao focar para facilitar edição
                setValorDisplay(
                  valorDisplay.replace(/\./g, '')
                );
              }}
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
                <SelectItem value="E">Estorno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔸 Forma Pgto + Comissionado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Forma de Pagamento</label>
            <Select
              value={formData.forma_pagamento}
              onValueChange={(val) =>
                setFormData({ ...formData, forma_pagamento: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P">Pix</SelectItem>
                <SelectItem value="B">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ✅ COMBOBOX DE COMISSIONADO (REAL) */}
          <div>
            <label className="text-sm">Comissionado (opcional)</label>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {formData.comissionado_id
                    ? funcionarios.find(
                        (f) => String(f.id) === formData.comissionado_id
                      )?.nome
                    : 'Selecione um funcionário'}
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
                  <CommandInput placeholder="Buscar funcionário..." />
                  <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>

                  <CommandGroup>
                    {/* Opção Nenhum */}
                    <CommandItem
                      value="nenhum"
                      onSelect={() =>
                        setFormData({ ...formData, comissionado_id: '' })
                      }
                    >
                      Nenhum
                    </CommandItem>

                    {funcionarios.map((func) => (
                      <CommandItem
                        key={func.id}
                        value={func.nome}
                        onSelect={() =>
                          setFormData({
                            ...formData,
                            comissionado_id: String(func.id),
                          })
                        }
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            formData.comissionado_id === String(func.id)
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

        </div>

        {/* 🔥 Pagamentos */}
        {receita && (
          <PaymentsTabs
            tipo="receita"
            entityId={receita.id}
            contasBancarias={bancos}
          />
        )}
      </div>
    </DialogBase>
  );
}
