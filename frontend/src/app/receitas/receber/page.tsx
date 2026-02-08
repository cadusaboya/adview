'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import ReceitaDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import StatusBadge from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';

import {
  getReceitasAbertas,
  createReceita,
  updateReceita,
  deleteReceita,
} from '@/services/receitas';

import {
  Receita,
  ReceitaCreate,
  ReceitaUpdate,
} from '@/types/receitas';

import { getClientes } from '@/services/clientes';
import { Cliente } from '@/types/clientes';
import { getBancos } from '@/services/bancos';
import { getAllocations } from '@/services/allocations';

import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

// ✅ Dropdown reutilizável
import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoaded, setClientesLoaded] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [bancosLoaded, setBancosLoaded] = useState(false);

  // Pagamentos pré-carregados para a receita sendo editada
  const [prefetchedPayments, setPrefetchedPayments] = useState<any[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // ======================
  // 🔄 LOAD
  // ======================
  const loadReceitas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getReceitasAbertas({
        page,
        page_size: pageSize,
        search: debouncedSearch,
      });
      setReceitas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      toast.error('Erro ao buscar receitas');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadReceitas();
  }, [loadReceitas]);

  // ======================
  // 🔄 PREFETCH ON MOUNT
  // ======================
  useEffect(() => {
    // Carregar dados auxiliares assim que a página monta
    prefetchAuxiliaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Só executa uma vez na montagem

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // 🔄 CLIENTES (RELATÓRIO) - Lazy load
  // ======================
  const loadClientes = useCallback(async () => {
    if (clientesLoaded) return;
    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
      setClientesLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar lista de clientes');
    }
  }, [clientesLoaded]);

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
    ]);
  };

  // ======================
  // ❌ DELETE
  // ======================
  const handleDeleteAction = async (id: number) => {
    try {
      await deleteReceita(id);
      toast.success('Receita excluída com sucesso!');
      loadReceitas();
    } catch {
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
      loadReceitas();
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
    onDelete: handleDeleteAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDelete = (id: number) => {
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
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (
    data: ReceitaCreate | ReceitaUpdate
  ) => {
    try {
      if (editingReceita) {
        await updateReceita(editingReceita.id, data as ReceitaUpdate);
        toast.success('Receita atualizada com sucesso!');
      } else {
        await createReceita(data as ReceitaCreate);
        toast.success('Receita criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingReceita(null);
      loadReceitas();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro: ${errorMessage}`);
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao gerar relatório';
      toast.error(errorMessage);
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
      width: '12%',
      render: (v: string) => formatDateBR(v),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente',
      width: '25%',
      render: (cliente: { nome?: string } | undefined) =>
        cliente?.nome || '—',
    },
    { title: 'Nome', dataIndex: 'nome', width: '25%' },
    {
      title: 'Situação',
      dataIndex: 'situacao',
      width: '12%',
      render: (v: 'A' | 'P' | 'V') => <StatusBadge status={v} />,
    },
    {
      title: 'Valor',
      dataIndex: 'valor_aberto',
      width: '12%',
      render: (v: number | undefined, record) =>
        formatCurrencyBR(v ?? record.valor),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Receita) => (
        <ActionsDropdown
          onOpen={async () => {
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

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Receitas em Aberto
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar por nome, cliente, valor, data..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80"
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
                await loadClientes();
                setOpenRelatorioModal(true);
              }}
              loading={loadingRelatorio}
              className="shadow-md whitespace-nowrap bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Relatório PDF
            </Button>

            <Button
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingReceita(null);
                setOpenDialog(true);
              }}
            >
              Criar Receita
            </Button>
          </div>
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

        <ReceitaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingReceita(null);
            setPrefetchedPayments([]);
            // loadReceitas() é chamado no handleSubmit após salvar com sucesso
          }}
          receita={editingReceita}
          onSubmit={handleSubmit}
          initialBancos={bancos}
          initialClientes={clientes}
          initialPayments={prefetchedPayments}
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
