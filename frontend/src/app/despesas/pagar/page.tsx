'use client';

import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { toast } from 'sonner';
import { DownloadOutlined } from '@ant-design/icons';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';

import type { TableColumnsType } from 'antd';

import {
  getDespesasAbertas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
  Despesa,
} from '@/services/despesas';

import { getFavorecidos, Favorecido } from '@/services/favorecidos';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

import StatusBadge from '@/components/ui/StatusBadge';
import DespesaDialog from '@/components/dialogs/DespesaDialog';
import { Input } from '@/components/ui/input';

export default function DespesasPagarPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Favorecido[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔎 SEARCH
  const [search, setSearch] = useState('');

  // 🔁 Debounce do search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1); // sempre volta pra página 1
      loadData();
    }, 300); // debounce

    return () => clearTimeout(timeout);
  }, [search]);

  // Carregar funcionários para o modal de relatório
  useEffect(() => {
    loadFuncionarios();
  }, []);

  const loadFuncionarios = async () => {
    try {
      const res = await getFavorecidos({ page_size: 1000 });
      setFuncionarios(res.results);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getDespesasAbertas({
        page,
        page_size: pageSize,
        search: search,
      });

      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar despesas:', error);
      toast.error('Erro ao buscar despesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    await deleteDespesa(id);
    loadData();
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingDespesa) {
        await updateDespesa(editingDespesa.id, data);
        toast.success('Despesa atualizada com sucesso!');
      } else {
        await createDespesa(data);
        toast.success('Despesa criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingDespesa(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      toast.error('Erro ao salvar despesa');
    }
  };

  // 📊 Gerar relatório com filtros
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

  const columns: TableColumnsType<Despesa> = [
    {
      title: 'Vencimento',
      dataIndex: 'data_vencimento',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: ['responsavel', 'nome'],
    },
    { title: 'Nome', dataIndex: 'nome' },
    {
      title: 'Situação',
      dataIndex: 'situacao',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      title: 'Valor',
      dataIndex: 'valor_aberto',
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingDespesa(record);
              setOpenDialog(true);
            }}
          >
            Editar
          </Button>

          <Button danger onClick={() => handleDelete(record.id)}>
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
        {/* 🔝 HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Despesas em Aberto
          </h1>

          <Input
            placeholder="Buscar por nome, favorecido, valor, data..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-md"
          />

          <div className="flex-1" />

          {/* 📊 BOTÃO PARA GERAR RELATÓRIO */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => setOpenRelatorioModal(true)}
            loading={loadingRelatorio}
          >
            Gerar Relatório PDF
          </Button>

          <Button
            className="shadow-md"
            onClick={() => {
              setOpenDialog(true);
              setEditingDespesa(null);
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
          onSubmit={handleSubmit}
          despesa={editingDespesa}
        />

        {/* 📊 MODAL DE FILTROS DO RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Despesas a Pagar"
          tipoRelatorio="despesas-a-pagar"
          favorecidos={funcionarios.map((f) => ({
            id: f.id,
            nome: f.nome,
          }))}
        />
      </main>
    </div>
  );
}
