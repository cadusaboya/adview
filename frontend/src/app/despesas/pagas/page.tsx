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

import { getPayments, deletePayment } from '@/services/payments';
import { updateDespesa, getDespesaById } from '@/services/despesas';
import { getFavorecidos, Favorecido } from '@/services/favorecidos';
import { gerarRelatorioPDF } from '@/services/pdf';

import { Payment } from '@/types/payments';
import { Despesa, DespesaUpdate } from '@/types/despesas';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { getErrorMessage } from '@/lib/errors';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';

export default function DespesasPagasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // 👥 Favorecidos (lazy)
  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);
  const [favorecidosLoaded, setFavorecidosLoaded] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ======================
  // 🔄 LOAD PAYMENTS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        tipo: 'despesa',
      });

      setPayments(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar pagamentos');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // 👥 LOAD FAVORECIDOS
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
  // ❌ DELETE PAYMENT
  // ======================
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Deseja realmente excluir este pagamento?')) return;

    try {
      await deletePayment(id);
      toast.success('Pagamento excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pagamento');
    }
  };

  // ======================
  // ✏️ EDITAR DESPESA
  // ======================
  const handleEditDespesa = async (despesaId?: number | null) => {
    if (!despesaId) return;

    try {
      setLoading(true);
      const despesa = await getDespesaById(despesaId);
      setEditingDespesa(despesa);
      setOpenDialog(true);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar despesa');
    } finally {
      setLoading(false);
    }
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
  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data de Pagamento',
      dataIndex: 'data_pagamento',
      width: '15%',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: 'favorecido_nome',
      width: '25%',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Nome',
      dataIndex: 'despesa_nome',
      width: '30%',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Valor Pago',
      dataIndex: 'valor',
      width: '15%',
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Payment) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar Despesa',
              icon: Pencil,
              onClick: () => handleEditDespesa(record.despesa),
            },
            {
              label: 'Excluir Pagamento',
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

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Despesas Pagas
          </h1>

          <Input
            placeholder="Buscar por favorecido, nome, valor, data..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-md"
          />

          <div className="flex-1" />

          <Button
            icon={<DownloadOutlined />}
            onClick={async () => {
              await loadFavorecidos();
              setOpenRelatorioModal(true);
            }}
            loading={loadingRelatorio}
            className="shadow-md whitespace-nowrap"
          >
            Gerar Relatório PDF
          </Button>
        </div>

        <GenericTable<Payment>
          columns={columns}
          data={payments}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (page) => setPage(page),
          }}
        />

        {/* DIALOG DESPESA */}
        {openDialog && (
          <DespesaDialog
            open={openDialog}
            despesa={editingDespesa}
            onClose={() => {
              setOpenDialog(false);
              setEditingDespesa(null);
            }}
            onSubmit={handleUpdateDespesa}
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
      </main>
    </div>
  );
}
