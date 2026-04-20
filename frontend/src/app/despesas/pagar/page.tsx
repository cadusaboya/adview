'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Grid } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { toast } from 'sonner';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Input } from '@/components/ui/input';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { Pencil, Trash } from 'lucide-react';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

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
import { useUpgradeGuard } from '@/hooks/useUpgradeGuard';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';
import { getBancos } from '@/services/bancos';
import { getAllocations } from '@/services/allocations';
import { PaymentUI } from '@/types/payments';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import StatusBadge from '@/components/ui/StatusBadge';

const { useBreakpoint } = Grid;

interface Responsavel {
  nome: string;
}

export default function DespesasPage() {
  const { guard, isUpgradeDialogOpen, closeUpgradeDialog, blockedFeatureLabel } = useUpgradeGuard();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // 📅 Filtro por data
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // Sort state
  const [ordering, setOrdering] = useState('');

  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);
  const [favorecidosLoaded, setFavorecidosLoaded] = useState(false);

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [bancosLoaded, setBancosLoaded] = useState(false);

  // Pagamentos pré-carregados para a despesa sendo editada
  const [prefetchedPayments, setPrefetchedPayments] = useState<PaymentUI[] | undefined>(undefined);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const screens = useBreakpoint();

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, startDate, endDate]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

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
        ordering: ordering || undefined,
        start_date: startDate,
        end_date: endDate,
      });

      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar despesas');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, ordering, startDate, endDate]);

  useEffect(() => {
    loadDespesas();
  }, [loadDespesas]);

  // ======================
  // 🔄 PREFETCH ON MOUNT
  // ======================
  useEffect(() => {
    // Carregar dados auxiliares assim que a página monta
    prefetchAuxiliaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Só executa uma vez na montagem

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
  // 🏦 BANCOS (LAZY)
  // ======================
  const loadBancos = async () => {
    if (bancosLoaded) return;

    try {
      const res = await getBancos({ page_size: 1000 });
      setBancos(res.results.map((b) => ({ id: b.id, nome: b.nome })));
      setBancosLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar bancos:', error);
    }
  };

  // ======================
  // 🔄 PREFETCH (quando clica para editar)
  // ======================
  const prefetchAuxiliaryData = async () => {
    await Promise.all([
      loadFavorecidos(),
      loadBancos(),
    ]);
  };

  // ======================
  // ❌ DELETE
  // ======================
  const handleDeleteAction = async (id: number) => {
    try {
      await deleteDespesa(id);
      toast.success('Despesa excluída com sucesso!');
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir despesa');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteDespesa(id))
      );

      toast.success(`${ids.length} despesa(s) excluída(s) com sucesso`);
      setSelectedRowKeys([]);
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir despesas');
    } finally {
      setLoading(false);
    }
  };

  const {
    confirmState,
    confirmDelete,
    confirmBulkDelete,
    handleConfirm,
    handleCancel,
  } = useDeleteConfirmation({
    onDelete: handleDeleteAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDelete = (id: number) => {
    const despesa = despesas.find((d) => d.id === id);
    confirmDelete(id, despesa?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos uma despesa');
      return;
    }
    confirmBulkDelete(selectedRowKeys.map(Number));
  };

  // ======================
  // 🔘 ROW SELECTION
  // ======================
  const handleSelectionChange = (selectedKeys: React.Key[]) => {
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
  const baseColumns: TableColumnsType<Despesa> = [
    {
      key: 'vencimento',
      title: 'Vencimento',
      dataIndex: 'data_vencimento',
      width: '12%',
      sorter: true,
      render: (value: string) => formatDateBR(value),
    },
    {
      key: 'favorecido',
      title: 'Favorecido',
      dataIndex: 'responsavel__nome',
      width: '22%',
      sorter: true,
      render: (_: unknown, record: Despesa) => (record.responsavel as Responsavel | undefined)?.nome || '—',
    },
    {
      key: 'nome',
      title: 'Nome',
      dataIndex: 'nome',
      width: '24%',
      sorter: true,
    },
    {
      key: 'situacao',
      title: 'Situação',
      dataIndex: 'situacao',
      width: '12%',
      render: (value: 'A' | 'P' | 'V') => (
        <StatusBadge status={value} />
      ),
    },
    {
      key: 'valor',
      title: 'Valor em Aberto',
      dataIndex: 'valor',
      width: '16%',
      sorter: true,
      render: (_v: unknown, record: Despesa) =>
        formatCurrencyBR(record.valor_aberto ?? record.valor),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Despesa) => (
        <ActionsDropdown
          onOpen={async () => {
            setPrefetchedPayments(undefined);
            // Prefetch apenas pagamentos (dados auxiliares já foram carregados no mount)
            try {
              const res = await getAllocations({ despesa_id: record.id, page_size: 9999 });
              setPrefetchedPayments(
                res.results.map((alloc) => ({
                  id: alloc.payment,
                  allocation_id: alloc.id,
                  data_pagamento: alloc.payment_info?.data_pagamento || '',
                  conta_bancaria: Number(alloc.payment_info?.conta_bancaria) || 0,
                  valor: alloc.valor,
                  observacao: alloc.observacao || '',
                }))
              );
            } catch (error) {
              console.error('Erro ao prefetch pagamentos:', error);
            }
          }}
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
  const columns = screens.md
    ? baseColumns
    : baseColumns
        .filter(col => ['favorecido', 'valor', 'actions'].includes(String(col.key)))
        .map(col => ({ ...col, width: col.key === 'actions' ? 50 : undefined }));

  // ======================
  // 🧱 RENDER
  // ======================
  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Despesas em Aberto</h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar despesas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80"
            />

            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
              }}
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
              onClick={guard('pdf_export', async () => {
                await loadFavorecidos();
                setOpenRelatorioModal(true);
              })}
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
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
          onSortChange={(o) => { setOrdering(o); setPage(1); }}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        <DespesaDialog
          open={openDialog}
          despesa={editingDespesa}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
            setPrefetchedPayments(undefined);
            // loadDespesas() é chamado no handleSubmit após salvar com sucesso
          }}
          onSubmit={handleSubmit}
          initialBancos={bancos}
          initialFavorecidos={favorecidos}
          initialPayments={prefetchedPayments}
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

        <UpgradeDialog
          open={isUpgradeDialogOpen}
          onClose={closeUpgradeDialog}
          feature={blockedFeatureLabel}
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir despesas selecionadas?' : 'Excluir despesa?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
