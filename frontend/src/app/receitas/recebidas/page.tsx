'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Grid, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import ReceitaDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import { Cliente } from '@/types/clientes';
import { Receita, ReceitaUpdate } from '@/types/receitas';
import { updateReceita, getReceitas, deleteReceita } from '@/services/receitas';

import { getClientes } from '@/services/clientes';
import { getBancos } from '@/services/bancos';
import { getFuncionarios } from '@/services/funcionarios';
import { Funcionario } from '@/types/funcionarios';
import { getAllocations } from '@/services/allocations';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { useUpgradeGuard } from '@/hooks/useUpgradeGuard';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { PaymentUI } from '@/types/payments';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';
import { Select } from 'antd';

const { useBreakpoint } = Grid;

export default function ReceitaRecebidasPage() {
  const { guard, isUpgradeDialogOpen, closeUpgradeDialog, blockedFeatureLabel } = useUpgradeGuard();

  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoaded, setClientesLoaded] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [bancosLoaded, setBancosLoaded] = useState(false);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosLoaded, setFuncionariosLoaded] = useState(false);
  const [funcionarioFiltro, setFuncionarioFiltro] = useState<number | undefined>(undefined);

  // Pagamentos pré-carregados para a receita sendo editada
  const [prefetchedPayments, setPrefetchedPayments] = useState<PaymentUI[] | undefined>(undefined);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 🔎 Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Sort state
  const [ordering, setOrdering] = useState('');

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const screens = useBreakpoint();

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, funcionarioFiltro]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // 🔄 PREFETCH ON MOUNT
  // ======================
  useEffect(() => {
    // Carregar dados auxiliares assim que a página monta
    prefetchAuxiliaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Só executa uma vez na montagem

  // ======================
  // 👥 CLIENTES (LAZY)
  // ======================
  const loadClientes = async () => {
    if (clientesLoaded) return;

    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
      setClientesLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  // ======================
  // 👥 FUNCIONÁRIOS (FILTRO)
  // ======================
  const loadFuncionarios = async () => {
    if (funcionariosLoaded) return;
    try {
      const res = await getFuncionarios({ page_size: 1000 });
      setFuncionarios(res.results.filter((f: Funcionario) => f.tipo === 'F' || f.tipo === 'P'));
      setFuncionariosLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
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
      loadClientes(),
      loadBancos(),
      loadFuncionarios(),
    ]);
  };

  // ======================
  // 🔄 LOAD RECEITAS PAGAS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getReceitas({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        situacao: 'P',
        ordering: ordering || undefined,
        funcionario_id: funcionarioFiltro,
      });

      setReceitas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar receitas pagas');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, ordering, funcionarioFiltro]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // ❌ DELETE RECEITA
  // ======================
  const handleDeleteReceitaAction = async (id: number) => {
    try {
      await deleteReceita(id);
      toast.success('Receita excluída com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir receita');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteReceita(id))
      );

      toast.success(`${ids.length} receita(s) excluída(s) com sucesso`);
      setSelectedRowKeys([]);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir receitas');
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
    onDelete: handleDeleteReceitaAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDeleteReceita = (id: number) => {
    const receita = receitas.find((r) => r.id === id);
    confirmDelete(id, receita?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos uma receita');
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
  // ✏️ EDITAR RECEITA
  // ======================
  const handleEditReceita = (receita: Receita) => {
    setEditingReceita(receita);
    setOpenDialog(true);
  };

  // ======================
  // 💾 UPDATE RECEITA
  // ======================
  const handleUpdateReceita = async (payload: ReceitaUpdate) => {
    if (!editingReceita) return;

    try {
      await updateReceita(editingReceita.id, payload);
      toast.success('Receita atualizada com sucesso!');
      setOpenDialog(false);
      setEditingReceita(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar receita');
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('receitas-pagas', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao gerar relatório';
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const baseColumns: TableColumnsType<Receita> = [
    {
      key: 'vencimento',
      title: 'Data de Vencimento',
      dataIndex: 'data_vencimento',
      width: '15%',
      sorter: true,
      render: (v: string) => formatDateBR(v),
    },
    {
      key: 'cliente',
      title: 'Cliente',
      dataIndex: 'cliente__nome',
      width: '25%',
      sorter: true,
      render: (_: unknown, record: Receita) => (record.cliente as { nome?: string } | undefined)?.nome ?? '—',
    },
    {
      key: 'nome',
      title: 'Descrição',
      dataIndex: 'nome',
      width: '30%',
      sorter: true,
      render: (v?: string) => v ?? '—',
    },
    {
      key: 'valor',
      title: 'Valor',
      dataIndex: 'valor',
      width: '15%',
      sorter: true,
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Receita) => (
        <ActionsDropdown
          onOpen={async () => {
            setPrefetchedPayments(undefined);
            // Prefetch apenas pagamentos (dados auxiliares já foram carregados no mount)
            try {
              const res = await getAllocations({ receita_id: record.id, page_size: 9999 });
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
              label: 'Editar Receita',
              icon: Pencil,
              onClick: () => handleEditReceita(record),
            },
            {
              label: 'Excluir Receita',
              icon: Trash,
              danger: true,
              onClick: () => handleDeleteReceita(record.id),
            },
          ]}
        />
      ),
    },
  ];
  const columns = screens.md
    ? baseColumns
    : baseColumns
        .filter(col => ['cliente', 'valor', 'actions'].includes(String(col.key)))
        .map(col => ({ ...col, width: col.key === 'actions' ? 50 : undefined }));

  // ======================
  // 🧱 RENDER
  // ======================
  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        {/* 🔝 HEADER */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Receitas Recebidas
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar por cliente, descrição, valor, data..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-80"
            />

            <Select
              allowClear
              placeholder="Filtrar por comissionado"
              style={{ width: 220 }}
              value={funcionarioFiltro}
              onChange={(val) => setFuncionarioFiltro(val ?? undefined)}
              options={funcionarios.map((f) => ({ value: f.id, label: f.nome }))}
              showSearch
              optionFilterProp="label"
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
              onClick={guard('pdf_export', () => setOpenRelatorioModal(true))}
              loading={loadingRelatorio}
              className="shadow-md whitespace-nowrap bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Relatório PDF
            </Button>
          </div>
        </div>

        <GenericTable<Receita>
          columns={columns}
          data={receitas}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
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

        {/* DIALOG RECEITA */}
        {openDialog && (
          <ReceitaDialog
            open={openDialog}
            receita={editingReceita}
            onClose={() => {
              setOpenDialog(false);
              setEditingReceita(null);
              setPrefetchedPayments(undefined);
            }}
            onSubmit={handleUpdateReceita}
            initialBancos={bancos}
            initialClientes={clientes}
            initialPayments={prefetchedPayments}
          />
        )}

        {/* 📊 MODAL RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Receitas Pagas"
          tipoRelatorio="receitas-pagas"
          clientes={clientes.map((c) => ({
            id: c.id,
            nome: c.nome,
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
          title={confirmState.isBulk ? 'Excluir receitas selecionadas?' : 'Excluir receita?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
