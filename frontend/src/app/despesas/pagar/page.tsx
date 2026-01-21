'use client';

import { useEffect, useState } from 'react';
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
  Despesa,
} from '@/services/despesas';

import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { getFavorecidos, Favorecido } from '@/services/favorecidos';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import StatusBadge from '@/components/ui/StatusBadge';

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  // 🔎 Busca
  const [search, setSearch] = useState('');

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // 👥 Favorecidos (LAZY)
  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);
  const [favorecidosLoaded, setFavorecidosLoaded] = useState(false);

  // 🔥 Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ======================
  // 🔄 LOAD DESPESAS
  // ======================
  const loadDespesas = async () => {
    try {
      setLoading(true);

      const res = await getDespesasAbertas({
        page,
        page_size: pageSize,
        search,
      });

      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar despesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDespesas();
  }, [page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadDespesas();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  // ======================
  // 👥 LOAD FAVORECIDOS (SÓ QUANDO PRECISAR)
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
  // 📊 GERAR RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('despesas-a-pagar', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao gerar relatório');
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
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: 'responsavel',
      render: (r: any) => r?.nome || '—',
    },
    {
      title: 'Nome',
      dataIndex: 'nome',
    },
    {
      title: 'Situação',
      dataIndex: 'situacao',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      title: 'Valor em Aberto',
      dataIndex: 'valor_aberto',
      render: (v, record) =>
        formatCurrencyBR(v ?? record.valor),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: Despesa) => (
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

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        {/* 🔝 HEADER */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Despesas em Aberto
          </h1>

          <div className="flex-1 md:px-6">
            <Input
              placeholder="Buscar por nome, favorecido, valor, data..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

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

          <Button
            className="shadow-md whitespace-nowrap"
            onClick={() => {
              setEditingDespesa(null);
              setOpenDialog(true);
            }}
          >
            Criar Despesa
          </Button>
        </div>

        <GenericTable<Despesa>
          columns={columns}
          data={despesas}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (page) => setPage(page),
          }}
        />

        {/* 🔹 DIALOG DESPESA */}
        <DespesaDialog
          open={openDialog}
          despesa={editingDespesa}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
          }}
          onSubmit={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
            loadDespesas();
          }}
        />

        {/* 📊 MODAL RELATÓRIO */}
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
