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
import ReceitaDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import {
  getPayments,
  deletePayment,
} from '@/services/payments';

import { Payment } from '@/types/payments';
import { Cliente } from '@/types/clientes';
import { Receita, ReceitaUpdate } from '@/types/receitas';
import { getReceitaById, updateReceita } from '@/services/receitas';

import { getClientes } from '@/services/clientes';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash, FileText } from 'lucide-react';

export default function ReceitaRecebidasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔎 Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ======================
  // 👥 CLIENTES (RELATÓRIO)
  // ======================
  const loadClientes = useCallback(async () => {
    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // ======================
  // 🔄 LOAD PAGAMENTOS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        tipo: 'receita',
      });

      setPayments(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar recebimentos');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // ❌ DELETE RECEBIMENTO
  // ======================
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Deseja realmente excluir este recebimento?')) return;

    try {
      await deletePayment(id);
      toast.success('Recebimento excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir recebimento');
    }
  };

  // ======================
  // ❌ BULK DELETE
  // ======================
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um recebimento');
      return;
    }

    if (!confirm(`Deseja realmente excluir ${selectedRowKeys.length} recebimento(s)?`)) return;

    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        selectedRowKeys.map((id) => deletePayment(Number(id)))
      );

      toast.success(`${selectedRowKeys.length} recebimento(s) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir recebimentos');
    } finally {
      setLoading(false);
    }
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
  const handleEditReceita = async (receitaId?: number | null) => {
    if (!receitaId) return;

    try {
      setLoading(true);
      const receita = await getReceitaById(receitaId);
      setEditingReceita(receita);
      setOpenDialog(true);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar receita');
    } finally {
      setLoading(false);
    }
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
  // 📄 GERAR RECIBO
  // ======================
  const handleGerarRecibo = async (paymentId: number) => {
    try {
      await gerarRelatorioPDF('recibo-pagamento', {
        payment_id: paymentId,
      });
      toast.success('Recibo gerado com sucesso!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao gerar recibo';
      console.error(error);
      toast.error(errorMessage);
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
  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data de Recebimento',
      dataIndex: 'data_pagamento',
      width: '15%',
      render: (v: string) => formatDateBR(v),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nome',
      width: '25%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Descrição',
      dataIndex: 'receita_nome',
      width: '30%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Valor Recebido',
      dataIndex: 'valor',
      width: '15%',
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Payment) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar Receita',
              icon: Pencil,
              onClick: () => handleEditReceita(record.receita),
            },
            {
              label: 'Gerar Recibo',
              icon: FileText,
              onClick: () => handleGerarRecibo(record.id),
            },
            {
              label: 'Excluir Recebimento',
              icon: Trash,
              danger: true,
              onClick: () => handleDeletePayment(record.id),
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
              onClick={() => setOpenRelatorioModal(true)}
              loading={loadingRelatorio}
              className="shadow-md whitespace-nowrap bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Relatório PDF
            </Button>
          </div>
        </div>

        <GenericTable<Payment>
          columns={columns}
          data={payments}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p) => setPage(p),
          }}
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
            }}
            onSubmit={handleUpdateReceita}
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
      </main>
    </div>
  );
}
