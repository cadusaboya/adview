'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';

import {
  getDespesasAbertas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
  Despesa,
} from '@/services/despesas';

import DespesaDialog from '@/components/dialogs/DespesaDialog';

export default function DespesasPagarPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10; // ✅ Page Size padrão definido

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getDespesasAbertas({ page, page_size: pageSize });
      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar despesas:', error);
      toast.error('Erro ao buscar despesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

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
      } else {
        await createDespesa(data);
        toast.success('Despesa criada com sucesso!');
      }
      setOpenDialog(false);
      setEditingDespesa(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      toast.error('Erro ao salvar despesa');
    }
  };

  const columns: TableColumnsType<Despesa> = [
    { title: 'Vencimento', dataIndex: 'data_vencimento' },
    { title: 'Favorecido', dataIndex: ['responsavel', 'nome'] },
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'Situação', dataIndex: 'situacao_display' },
    {
      title: 'Valor',
      dataIndex: 'valor',
      render: (v) => `R$ ${Number(v).toFixed(2)}`,
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
          <h1 className="text-xl font-semibold">Despesas em Aberto</h1>
          <Button
            color="default"
            className='shadow-md'
            onClick={() => {
              setOpenDialog(true);
              setEditingDespesa(null);
            }}
          >
            Criar Despesa
          </Button>
        </div>

        <GenericTable<Despesa>
          columns={columns}
          data={despesas}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (page) => setPage(page),
          }}
        />

        <DespesaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
          }}
          onSubmit={handleSubmit}
          despesa={editingDespesa}
        />
      </main>
    </div>
  );
}
