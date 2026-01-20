'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import MovimentacaoDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import StatusBadge from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';

import {
  getReceitasAbertas,
  createReceita,
  updateReceita,
  deleteReceita,
  Receita,
} from '@/services/receitas';
import { getClientes, Cliente } from '@/services/clientes';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';

// ✅ Dropdown reutilizável
import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [search, setSearch] = useState('');

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ======================
  // 🔄 LOAD
  // ======================
  const loadReceitas = async () => {
    try {
      setLoading(true);
      const res = await getReceitasAbertas({
        page,
        page_size: pageSize,
        search,
      });
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadReceitas();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  // ======================
  // 🔄 CLIENTES (RELATÓRIO)
  // ======================
  useEffect(() => {
    (async () => {
      try {
        const res = await getClientes({ page_size: 1000 });
        setClientes(res.results);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      }
    })();
  }, []);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta receita?')) return;

    try {
      await deleteReceita(id);
      toast.success('Receita excluída com sucesso!');
      loadReceitas();
    } catch {
      toast.error('Erro ao excluir receita');
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (data: any) => {
    try {
      if (editingReceita) {
        await updateReceita(editingReceita.id, data);
        toast.success('Receita atualizada com sucesso!');
      } else {
        await createReceita(data);
        toast.success('Receita criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingReceita(null);
      loadReceitas();
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.detail ||
        JSON.stringify(error?.response?.data) ||
        'Erro desconhecido';

      toast.error(`Erro: ${apiMessage}`);
      throw error;
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('receitas-a-receber', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar relatório');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // ======================
  // 📊 COLUNAS
  // ======================
  const columns: TableColumnsType<Receita> = [
    {
      title: 'Vencimento',
      dataIndex: 'data_vencimento',
      render: (v) => formatDateBR(v),
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
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'Valor',
      dataIndex: 'valor_aberto',
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: Receita) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingReceita(record);
                setOpenDialog(true);
              },
            },
            {
              label: 'Excluir',
              icon: Trash,
              danger: true,
              onClick: () => handleDelete(record.id),
            },
          ]}
        />
      ),
    },
  ];

  // ======================
  // 🧱 RENDER
  // ======================
  return (
    <div className="flex">
      <NavbarNested />

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Receitas em Aberto
          </h1>

          <div className="flex-1 md:px-6">
            <Input
              placeholder="Buscar por nome, cliente, valor, data..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Button
            icon={<DownloadOutlined />}
            onClick={() => setOpenRelatorioModal(true)}
            loading={loadingRelatorio}
            className="shadow-md whitespace-nowrap"
          >
            Gerar Relatório PDF
          </Button>

          <Button
            className="shadow-md"
            onClick={() => {
              setEditingReceita(null);
              setOpenDialog(true);
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
            pageSize,
            total,
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
