'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { toast } from 'sonner';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Input } from '@/components/ui/input';
import { Pencil, Trash } from 'lucide-react';

import DespesaDialog from '@/components/dialogs/DespesaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';

import {
  getDespesasAbertas,
  deleteDespesa,
  createDespesa,
  updateDespesa,
} from '@/services/despesas';

import {
  Despesa,
  DespesaCreate,
  DespesaUpdate,
} from '@/types/despesas';

import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import StatusBadge from '@/components/ui/StatusBadge';

interface Responsavel {
  nome: string;
}

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);
  const [favorecidosLoaded, setFavorecidosLoaded] = useState(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ======================
  // 🔄 LOAD DESPESAS
  // ======================
  const loadDespesas = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getDespesasAbertas({
        page,
        page_size: pageSize,
        search: debouncedSearch,
      });

      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar despesas');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadDespesas();
  }, [loadDespesas]);

  // ======================
  // 👥 FAVORECIDOS (LAZY)
  // ======================
  const loadFavorecidos = async () => {
    if (favorecidosLoaded) return;

    try {
      const res = await getFavorecidos({ page_size: 1000 });
      setFavorecidos(res.results);
      setFavorecidosLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar favorecidos:', error);
    }
  };

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;

    try {
      await deleteDespesa(id);
      toast.success('Despesa excluída com sucesso!');
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir despesa');
    }
  };

  // ======================
  // ❌ BULK DELETE
  // ======================
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos uma despesa');
      return;
    }

    if (!confirm(`Deseja realmente excluir ${selectedRowKeys.length} despesa(s)?`)) return;

    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        selectedRowKeys.map((id) => deleteDespesa(Number(id)))
      );

      toast.success(`${selectedRowKeys.length} despesa(s) excluída(s) com sucesso`);
      setSelectedRowKeys([]);
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir despesas');
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 🔘 ROW SELECTION
  // ======================
  const handleSelectionChange = (selectedKeys: React.Key[], _selectedRows: Despesa[]) => {
    setSelectedRowKeys(selectedKeys);
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (
    data: DespesaCreate | DespesaUpdate
  ) => {
    try {
      if (editingDespesa) {
        await updateDespesa(editingDespesa.id, data as DespesaUpdate);
        toast.success('Despesa atualizada com sucesso!');
      } else {
        await createDespesa(data as DespesaCreate);
        toast.success('Despesa criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingDespesa(null);
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar despesa');
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('despesas-a-pagar', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erro ao gerar relatório';
      toast.error(errorMessage);
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Despesa> = [
    {
      title: 'Vencimento',
      dataIndex: 'data_vencimento',
      width: '12%',
      render: (value: string) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: 'responsavel',
      width: '22%',
      render: (r: Responsavel | undefined) => r?.nome || '—',
    },
    {
      title: 'Nome',
      dataIndex: 'nome',
      width: '24%',
    },
    {
      title: 'Situação',
      dataIndex: 'situacao',
      width: '12%',
      render: (value: 'A' | 'P' | 'V') => (
        <StatusBadge status={value} />
      ),
    },
    {
      title: 'Valor em Aberto',
      dataIndex: 'valor_aberto',
      width: '16%',
      render: (v: number | undefined, record: Despesa) =>
        formatCurrencyBR(v ?? record.valor),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Despesa) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingDespesa(record);
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

      <main className="bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Despesas em Aberto</h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar despesas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80"
            />

            {selectedRowKeys.length > 0 && (
              <Button
                danger
                className="shadow-md"
                onClick={handleBulkDelete}
                icon={<Trash className="w-4 h-4" />}
              >
                Excluir {selectedRowKeys.length} selecionado(s)
              </Button>
            )}

            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                await loadFavorecidos();
                setOpenRelatorioModal(true);
              }}
              loading={loadingRelatorio}
              className="shadow-md bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Relatório PDF
            </Button>

            <Button
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingDespesa(null);
                setOpenDialog(true);
              }}
            >
              Criar Despesa
            </Button>
          </div>
        </div>

        <GenericTable<Despesa>
          columns={columns}
          data={despesas}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => setPage(p),
          }}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        <DespesaDialog
          open={openDialog}
          despesa={editingDespesa}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
            loadDespesas(); // Refetch para atualizar mudanças (ex: pagamentos)
          }}
          onSubmit={handleSubmit}
        />

        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Despesas a Pagar"
          tipoRelatorio="despesas-a-pagar"
          favorecidos={favorecidos.map((f) => ({
            id: f.id,
            nome: f.nome,
          }))}
        />
      </main>
    </div>
  );
}
