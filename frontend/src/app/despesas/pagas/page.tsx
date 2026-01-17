'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { formatDateBR } from '@/lib/formatters';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import DespesaDialog from '@/components/dialogs/DespesaDialog';

import {
  getPayments,
  deletePayment,
  Payment,
} from '@/services/payments';

import { Despesa } from '@/services/despesas';

export default function DespesasPagasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
      });

      // 🔹 Apenas pagamentos vinculados a despesas
      const despesaPayments = res.results.filter(
        (p: Payment) => p.despesa !== null
      );

      setPayments(despesaPayments);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

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

  const handleEditDespesa = (despesaId?: number | null) => {
    if (!despesaId) return;

    // 🔹 O dialog já sabe buscar a despesa completa
    setEditingDespesa({ id: despesaId } as Despesa);
    setOpenDialog(true);
  };

  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data de Pagamento',
      dataIndex: 'data_pagamento',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: 'favorecido_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Nome',
      dataIndex: 'despesa_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Valor Pago',
      dataIndex: 'valor',
      render: (valor) => `R$ ${Number(valor).toFixed(2)}`,
    },
    {
      title: 'Ações',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button onClick={() => handleEditDespesa(record.despesa)}>
            Editar
          </Button>
          <Button
            danger
            onClick={() => handleDeletePayment(record.id)}
          >
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
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Despesas Pagas</h1>
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

        <DespesaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
          }}
          despesa={editingDespesa}
          onSubmit={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
            loadData();
          }}
        />
      </main>
    </div>
  );
}
