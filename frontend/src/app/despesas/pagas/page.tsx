'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';

import {
  getDespesasPagas,
  deleteDespesa,
  updateDespesa,
  Despesa,
} from '@/services/despesas';

import DespesaDialog from '@/components/dialogs/DespesaDialog';

export default function DespesasPagasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getDespesasPagas();
      setDespesas(data);
    } catch (error) {
      console.error('Erro ao buscar despesas:', error);
      message.error('Erro ao buscar despesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir esta despesa?')) {
      await deleteDespesa(id);
      loadData();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingDespesa) {
        await updateDespesa(editingDespesa.id, data);
        toast.success('Despesa atualizada com sucesso!');
      }
      setOpenDialog(false);
      setEditingDespesa(null);
      loadData();
    } catch (error) {
      console.error('Erro ao editar despesa:', error);
      toast.error('Erro ao editar despesa');
    }
  };

  const columns: TableColumnsType<Despesa> = [
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'Favorecido', dataIndex: ['responsavel', 'nome'] },
    {
      title: 'Valor',
      dataIndex: 'valor',
      render: (valor) => `R$ ${Number(valor).toFixed(2)}`,
    },
    { title: 'Data de Vencimento', dataIndex: 'data_vencimento' },
    { title: 'Data de Pagamento', dataIndex: 'data_pagamento' },
    {
      title: 'Valor Pago',
      dataIndex: 'valor_pago',
      render: (valor) => (valor ? `R$ ${Number(valor).toFixed(2)}` : '—'),
    },
    {
      title: 'Ações',
      dataIndex: 'acoes',
      render: (_: any, record: Despesa) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingDespesa(record);
              setOpenDialog(true);
            }}
          >
            Editar
          </Button>
          <Button danger onClick={() => handleDelete(record.id)}>
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex">
      <NavbarNested />
      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Despesas Pagas</h1>
        </div>

        <GenericTable<Despesa>
          columns={columns}
          data={despesas}
          loading={loading}
        />

        <DespesaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
          }}
          despesa={editingDespesa}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
