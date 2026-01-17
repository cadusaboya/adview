'use client';

import { useEffect, useState } from 'react';
import { Button, Pagination, message } from 'antd';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';
import {
  getReceitasAbertas,
  createReceita,
  updateReceita,
  deleteReceita,
  Receita,
} from '@/services/receitas';
import MovimentacaoDialog from '@/components/dialogs/ReceitaDialog';
import { toast } from 'sonner';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import StatusBadge from '@/components/ui/StatusBadge';

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔄 Carregar receitas
  const loadReceitas = async () => {
    try {
      setLoading(true);
      const res = await getReceitasAbertas({ page, page_size: pageSize });
      setReceitas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      message.error('Erro ao buscar receitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceitas();
  }, [page]);

  // ❌ Deletar receita
  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir esta receita?')) {
      await deleteReceita(id);
      loadReceitas();
    }
  };

  // ✅ Criar ou Editar receita
  const handleSubmit = async (data: any) => {
    try {
      let receitaSalva;

      if (editingReceita) {
        receitaSalva = await updateReceita(editingReceita.id, data);
        toast.success('Receita atualizada com sucesso!');
      } else {
        receitaSalva = await createReceita(data);
        toast.success('Receita criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingReceita(null);
      loadReceitas();

      return receitaSalva;
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);

      const apiMessage =
        error?.response?.data?.detail ||
        JSON.stringify(error?.response?.data) ||
        'Erro desconhecido';

      toast.error(`Erro: ${apiMessage}`);
      throw error;
    }
  };

  // 🏛️ Colunas da tabela
  const columns: TableColumnsType<Receita> = [
    { title: 'Vencimento', dataIndex: 'data_vencimento', render: (value) => formatDateBR(value),},
    {
      title: 'Cliente',
      dataIndex: 'cliente',
      render: (cliente: any) => cliente?.nome || '—',
    },
    { title: 'Nome', dataIndex: 'nome' },
    {
      title: 'Situação',
      dataIndex: 'situacao',
      render: (value) => <StatusBadge status={value} />,
    },

    {
      title: 'Valor',
      dataIndex: 'valor',
      render: (v) => formatCurrencyBR(v),
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
          <h1 className="text-xl font-semibold">Receitas em Aberto</h1>
          <Button
            color="default"
            className='shadow-md'
            onClick={() => {
              setOpenDialog(true);
              setEditingReceita(null);
            }}
          >
            Criar Receita
          </Button>
        </div>

        <GenericTable<Receita> columns={columns} data={receitas} loading={loading} 
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              onChange: (page) => setPage(page),
            }}
        />

        <MovimentacaoDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingReceita(null);
          }}
          title={editingReceita ? 'Editar Receita' : 'Nova Receita'}
          pessoaLabel="Cliente"
          tipoOptions={[
            { label: 'Fixa', value: 'F' },
            { label: 'Variável', value: 'V' },
            { label: 'Estorno', value: 'E' },
          ]}
          receita={editingReceita}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
