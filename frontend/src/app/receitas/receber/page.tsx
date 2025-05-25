'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';
import { getReceitas, createReceita, deleteReceita, Receita } from '@/services/receitas';
import MovimentacaoDialog from '@/components/dialogs/MovimentacaoDialog';
import { toast } from 'sonner';

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  // 🔄 Carregar receitas
  const loadReceitas = async () => {
    try {
      setLoading(true);
      const data = await getReceitas();
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

  // ✅ Criar receita
  const handleSubmit = async (data: any) => {
    try {
      await createReceita(data);
      toast.success("Receita criada com sucesso!");
      setOpenDialog(false);
      loadReceitas();
    } catch (error: any) {
      console.error("Erro ao criar receita:", error);
  
      const apiMessage =
        error?.response?.data?.detail ||
        JSON.stringify(error?.response?.data) ||
        "Erro desconhecido";
  
      toast.error(`Erro: ${apiMessage}`);
    }
  };
  

  // 🏛️ Colunas da tabela
  const columns: TableColumnsType<Receita> = [
    { title: 'Cliente', dataIndex: 'cliente', render: (cliente: any) => cliente?.nome || '—'},
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'Vencimento', dataIndex: 'data_vencimento' },
    { title: 'Valor', dataIndex: 'valor' },
    { title: 'Situação', dataIndex: 'situacao_display' },
    {
      title: 'Ações',
      dataIndex: 'acoes',
      render: (_: any, record: Receita) => (
        <Button danger onClick={() => handleDelete(record.id)}>
          Excluir
        </Button>
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
        <Button color="default" variant="solid" onClick={() => setOpenDialog(true)}>
            Criar Receita
          </Button>
        </div>

        {/* 🗒️ Tabela */}
        <GenericTable<Receita> columns={columns} data={receitas} loading={loading} />

        {/* 🪟 Dialog */}
        <MovimentacaoDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          title="Nova Receita"
          pessoaLabel="Cliente"
          tipoOptions={[
            { label: 'Fixa', value: 'F' },
            { label: 'Variável', value: 'V' },
            { label: 'Estorno', value: 'E' },
          ]}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
