'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import CustodiaDialog from '@/components/dialogs/CustodiaDialog';
import { Input } from '@/components/ui/input';

import {
  getCustodias,
  createCustodia,
  updateCustodia,
  deleteCustodia,
} from '@/services/custodias';

import {
  Custodia,
  CustodiaCreate,
  CustodiaUpdate,
} from '@/types/custodias';

import { formatCurrencyBR, formatDateBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';

export default function PassivosPage() {
  const [custodias, setCustodias] = useState<Custodia[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCustodia, setEditingCustodia] = useState<Custodia | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // ======================
  // 🔄 LOAD DATA
  // ======================
  const loadCustodias = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCustodias({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        tipo: 'P',
      });
      setCustodias(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar passivos de custódia:', error);
      message.error('Erro ao buscar passivos de custódia');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadCustodias();
  }, [loadCustodias]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este passivo de custódia?')) return;

    try {
      await deleteCustodia(id);
      toast.success('Passivo de custódia excluído com sucesso!');
      loadCustodias();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir passivo de custódia');
    }
  };

  // ======================
  // ❌ BULK DELETE
  // ======================
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um passivo');
      return;
    }

    if (!confirm(`Deseja realmente excluir ${selectedRowKeys.length} passivo(s) de custódia?`)) return;

    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        selectedRowKeys.map((id) => deleteCustodia(Number(id)))
      );

      toast.success(`${selectedRowKeys.length} passivo(s) de custódia excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadCustodias();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir passivos de custódia');
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
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (
    data: CustodiaCreate | CustodiaUpdate
  ) => {
    try {
      if (editingCustodia) {
        await updateCustodia(
          editingCustodia.id,
          data as CustodiaUpdate
        );
        toast.success('Passivo de custódia atualizado com sucesso!');
      } else {
        await createCustodia(data as CustodiaCreate);
        toast.success('Passivo de custódia criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingCustodia(null);
      loadCustodias();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar passivo de custódia');
      throw error;
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; bg: string }> = {
      'Aberto': { color: 'text-red-600', bg: 'bg-red-50' },
      'Parcial': { color: 'text-yellow-600', bg: 'bg-yellow-50' },
      'Liquidado': { color: 'text-green-600', bg: 'bg-green-50' },
    };

    const statusStyle = statusMap[status] || { color: 'text-gray-600', bg: 'bg-gray-50' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle.color} ${statusStyle.bg}`}>
        {status}
      </span>
    );
  };

  const columns: TableColumnsType<Custodia> = [
    {
      title: 'Nome',
      dataIndex: 'nome',
      width: '18%',
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo_display',
      width: '10%',
    },
    {
      title: 'Pessoa',
      key: 'pessoa',
      width: '16%',
      render: (_: unknown, record: Custodia) => {
        if (record.cliente) {
          return (
            <div>
              <div className="font-medium">{record.cliente.nome}</div>
              <div className="text-xs text-gray-500">Cliente</div>
            </div>
          );
        }
        if (record.funcionario) {
          return (
            <div>
              <div className="font-medium">{record.funcionario.nome}</div>
              <div className="text-xs text-gray-500">Funcionário/Fornecedor</div>
            </div>
          );
        }
        return '—';
      },
    },
    {
      title: 'Valor Total',
      dataIndex: 'valor_total',
      width: '12%',
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Valor Liquidado',
      dataIndex: 'valor_liquidado',
      width: '12%',
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Saldo',
      key: 'saldo',
      width: '10%',
      render: (_: unknown, record: Custodia) => {
        const saldo = record.valor_total - record.valor_liquidado;
        return (
          <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
            {formatCurrencyBR(saldo)}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status_display',
      width: '10%',
      render: (status: string) => getStatusBadge(status),
    },
    {
      title: 'Criado em',
      dataIndex: 'criado_em',
      width: '10%',
      render: (data: string) => formatDateBR(data),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Custodia) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingCustodia(record);
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

      <main className="bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Passivos de Custódia
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar passivos de custódia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingCustodia(null);
                setOpenDialog(true);
              }}
            >
              Criar Passivo
            </Button>
          </div>
        </div>

        <GenericTable<Custodia>
          columns={columns}
          data={custodias}
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
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        <CustodiaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingCustodia(null);
            loadCustodias();
          }}
          onSubmit={handleSubmit}
          custodia={editingCustodia}
          tipo="P"
        />
      </main>
    </div>
  );
}
