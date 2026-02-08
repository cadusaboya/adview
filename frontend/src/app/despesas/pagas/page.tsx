'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import DespesaDialog from '@/components/dialogs/DespesaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import { updateDespesa, getDespesas, deleteDespesa } from '@/services/despesas';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';
import { getBancos } from '@/services/bancos';
import { getAllocations } from '@/services/allocations';
import { gerarRelatorioPDF } from '@/services/pdf';

import { Despesa, DespesaUpdate } from '@/types/despesas';
import { PaymentUI } from '@/types/payments';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { getErrorMessage } from '@/lib/errors';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

export default function DespesasPagasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // 👥 Favorecidos (lazy)
  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);
  const [favorecidosLoaded, setFavorecidosLoaded] = useState(false);

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [bancosLoaded, setBancosLoaded] = useState(false);

  // Pagamentos pré-carregados para a despesa sendo editada
  const [prefetchedPayments, setPrefetchedPayments] = useState<PaymentUI[]>([]);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // 🔄 LOAD DESPESAS PAGAS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getDespesas({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        situacao: 'P', // Apenas despesas pagas
      });

      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar despesas pagas');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // 🔄 PREFETCH ON MOUNT
  // ======================
  useEffect(() => {
    // Carregar dados auxiliares assim que a página monta
    prefetchAuxiliaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Só executa uma vez na montagem

  // ======================
  // 👥 LOAD FAVORECIDOS (LAZY)
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
  // ❌ DELETE DESPESA
  // ======================
  const handleDeleteDespesaAction = async (id: number) => {
    try {
      await deleteDespesa(id);
      toast.success('Despesa excluída com sucesso!');
      loadData();
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
      loadData();
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
    onDelete: handleDeleteDespesaAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDeleteDespesa = (id: number) => {
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
  // ✏️ EDITAR DESPESA
  // ======================
  const handleEditDespesa = (despesa: Despesa) => {
    setEditingDespesa(despesa);
    setOpenDialog(true);
  };

  // ======================
  // 💾 UPDATE DESPESA
  // ======================
  const handleUpdateDespesa = async (payload: DespesaUpdate) => {
    if (!editingDespesa) return;

    try {
      await updateDespesa(editingDespesa.id, payload);
      toast.success('Despesa atualizada com sucesso!');
      setOpenDialog(false);
      setEditingDespesa(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar despesa');
    }
  };

  // ======================
  // 📊 GERAR RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('despesas-pagas', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao buscar dados'));
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Despesa> = [
    {
      title: 'Data de Vencimento',
      dataIndex: 'data_vencimento',
      width: '15%',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: ['responsavel', 'nome'],
      width: '25%',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Nome',
      dataIndex: 'nome',
      width: '30%',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      width: '15%',
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Despesa) => (
        <ActionsDropdown
          onOpen={async () => {
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
              label: 'Editar Despesa',
              icon: Pencil,
              onClick: () => handleEditDespesa(record),
            },
            {
              label: 'Excluir Despesa',
              icon: Trash,
              danger: true,
              onClick: () => handleDeleteDespesa(record.id),
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

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        {/* HEADER */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Despesas Pagas
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar por favorecido, nome, valor, data..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
              className="shadow-md whitespace-nowrap bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Relatório PDF
            </Button>
          </div>
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
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        {/* DIALOG DESPESA */}
        {openDialog && (
          <DespesaDialog
            open={openDialog}
            despesa={editingDespesa}
            onClose={() => {
              setOpenDialog(false);
              setEditingDespesa(null);
              setPrefetchedPayments([]);
            }}
            onSubmit={handleUpdateDespesa}
            initialBancos={bancos}
            initialFavorecidos={favorecidos}
            initialPayments={prefetchedPayments}
          />
        )}

        {/* MODAL RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Despesas Pagas"
          tipoRelatorio="despesas-pagas"
          favorecidos={favorecidos.map((f) => ({
            id: f.id,
            nome: f.nome,
          }))}
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
