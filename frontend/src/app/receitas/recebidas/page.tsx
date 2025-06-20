'use client';

import { useEffect, useState } from 'react';
import { Button, Pagination, message } from 'antd';
import { toast } from 'sonner';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';

import {
  getReceitasRecebidas,
  updateReceita,
  deleteReceita,
  Receita,
} from '@/services/receitas';

import ReceitaDialog from '@/components/dialogs/ReceitaDialog';

export default function ReceitaRecebidasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getReceitasRecebidas({ page, page_size: pageSize });
      setReceitas(data.results);
      setTotal(data.count);
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      message.error('Erro ao buscar receitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir esta receita?')) {
      await deleteReceita(id);
      loadData();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingReceita) {
        await updateReceita(editingReceita.id, data);
        toast.success('Receita atualizada com sucesso!');
      }

      setOpenDialog(false);
      setEditingReceita(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);

      const apiMessage =
        error?.response?.data?.detail ||
        JSON.stringify(error?.response?.data) ||
        'Erro desconhecido';

      toast.error(`Erro: ${apiMessage}`);
    }
  };

  const columns: TableColumnsType<Receita> = [
    { title: 'Data de Pagamento', dataIndex: 'data_pagamento' },
    { title: 'Cliente', dataIndex: ['cliente', 'nome'] },
    { title: 'Nome', dataIndex: 'nome' },
    {
      title: 'Valor Pago',
      dataIndex: 'valor_pago',
      render: (valor) => (valor ? `R$ ${Number(valor).toFixed(2)}` : '—'),
    },
    {
      title: 'Ações',
      dataIndex: 'acoes',
      render: (_: any, record: Receita) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingReceita(record);
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
          <h1 className="text-xl font-semibold">Receitas Recebidas</h1>
        </div>

        <GenericTable<Receita> columns={columns} data={receitas} loading={loading}           
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              onChange: (page) => setPage(page),
             }}
        />

        <ReceitaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingReceita(null);
          }}
          title="Editar Receita"
          receita={editingReceita}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
