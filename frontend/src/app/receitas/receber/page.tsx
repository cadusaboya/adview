'use client';

import { useEffect, useState } from 'react';
import { Button, Pagination, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
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
import { getClientes, Cliente } from '@/services/clientes';
import MovimentacaoDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { toast } from 'sonner';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import StatusBadge from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [search, setSearch] = useState('');

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔄 Carregar receitas
  const loadReceitas = async () => {
    try {
      setLoading(true);
      const res = await getReceitasAbertas({ page, page_size: pageSize, search });
      setReceitas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      message.error('Erro ao buscar receitas');
    } finally {
      setLoading(false);
    }
  };

  // Carregar clientes para o modal de relatório
  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  useEffect(() => {
    loadReceitas();
  }, [page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1); // sempre volta pra página 1
      loadReceitas();
    }, 300); // debounce

    return () => clearTimeout(timeout);
  }, [search]);

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

  // 📊 Gerar relatório com filtros
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('receitas-a-receber', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao gerar relatório');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // 🏛️ Colunas da tabela
  const columns: TableColumnsType<Receita> = [
    {
      title: 'Vencimento',
      dataIndex: 'data_vencimento',
      render: (value) => formatDateBR(value),
    },
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
      dataIndex: 'valor_aberto',
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
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 🔹 Título */}
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Receitas em Aberto
          </h1>

          {/* 🔍 Busca */}
          <div className="flex-1 md:px-6">
            <Input
              placeholder="Buscar por nome, cliente, valor, data..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full"
            />
          </div>

          {/* 📊 BOTÃO PARA GERAR RELATÓRIO */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => setOpenRelatorioModal(true)}
            loading={loadingRelatorio}
            className="whitespace-nowrap"
          >
            Gerar Relatório PDF
          </Button>

          {/* ➕ Ação */}
          <Button
            className="shadow-md whitespace-nowrap"
            onClick={() => {
              setOpenDialog(true);
              setEditingReceita(null);
            }}
          >
            Criar Receita
          </Button>
        </div>

        <GenericTable<Receita>
          columns={columns}
          data={receitas}
          loading={loading}
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

        {/* 📊 MODAL DE FILTROS DO RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Receitas a Receber"
          tipoRelatorio="receitas-a-receber"
          clientes={clientes.map((c) => ({
            id: c.id,
            nome: c.nome,
          }))}
        />
      </main>
    </div>
  );
}
