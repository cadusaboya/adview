'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
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

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  // 🔄 Carregar receitas
  const loadReceitas = async () => {
    try {
      setLoading(true);
      const data = await getReceitasAbertas();
      setReceitas(data);
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      message.error('Erro ao buscar receitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceitas();
  }, []);

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

      return receitaSalva; // 🔥 Isso é FUNDAMENTAL para o Dialog conseguir criar os pagamentos
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);

      const apiMessage =
        error?.response?.data?.detail ||
        JSON.stringify(error?.response?.data) ||
        'Erro desconhecido';

      toast.error(`Erro: ${apiMessage}`);
      throw error; // 🔥 Importante: propaga o erro para o Dialog se quiser tratar lá também
    }
  };


  // 🏛️ Colunas da tabela
  const columns: TableColumnsType<Receita> = [
    {
      title: 'Cliente',
      dataIndex: 'cliente',
      render: (cliente: any) => cliente?.nome || '—',
    },
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'Vencimento', dataIndex: 'data_vencimento' },
    {
      title: 'Valor',
      dataIndex: 'valor',
      render: (v) => `R$ ${Number(v).toFixed(2)}`,
    },
    { title: 'Situação', dataIndex: 'situacao_display' },
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
      {/* 🔳 Navbar */}
      <NavbarNested />

      {/* 🔹 Conteúdo */}
      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        {/* 🔘 Botão Criar */}
        <div className="flex justify-end mb-4">
          <Button
            color="default"
            variant="solid"
            onClick={() => {
              setOpenDialog(true);
              setEditingReceita(null);
            }}
          >
            Criar Receita
          </Button>
        </div>

        {/* 🗒️ Tabela */}
        <GenericTable<Receita> columns={columns} data={receitas} loading={loading} />

        {/* 🪟 Dialog */}
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
          receita={editingReceita} // 🔥 Envia dados para edição se tiver
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
