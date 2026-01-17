'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { formatDateBR } from '@/lib/formatters';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import ReceitaDialog from '@/components/dialogs/ReceitaDialog';

import {
  getPayments,
  deletePayment,
  Payment,
} from '@/services/payments';

import { Receita } from '@/services/receitas';

export default function ReceitaRecebidasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

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

      // 🔹 Apenas pagamentos vinculados a receitas
      const receitaPayments = res.results.filter(
        (p: Payment) => p.receita !== null
      );

      setPayments(receitaPayments);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar recebimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

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

  const handleEditReceita = (receitaId?: number | null) => {
    if (!receitaId) return;

    // 🔹 O dialog já sabe buscar a receita completa
    setEditingReceita({ id: receitaId } as Receita);
    setOpenDialog(true);
  };

  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data de Recebimento',
      dataIndex: 'data_pagamento',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Descrição',
      dataIndex: 'receita_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Valor Recebido',
      dataIndex: 'valor',
      render: (valor) => `R$ ${Number(valor).toFixed(2)}`,
    },
    {
      title: 'Ações',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button onClick={() => handleEditReceita(record.receita)}>
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
          <h1 className="text-xl font-semibold">Receitas Recebidas</h1>
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

        <ReceitaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingReceita(null);
          }}
          receita={editingReceita}
          onSubmit={() => {
            setOpenDialog(false);
            setEditingReceita(null);
            loadData();
          }}
        />
      </main>
    </div>
  );
}
