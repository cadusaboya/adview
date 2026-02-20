'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import DespesaRecorrenteDialog from '@/components/dialogs/DespesaRecorrenteDialog';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  getDespesasRecorrentes,
  createDespesaRecorrente,
  updateDespesaRecorrente,
  deleteDespesaRecorrente,
  gerarDespesasDoMes,
  gerarProximosMeses,
} from '@/services/despesasRecorrentes';

import {
  DespesaRecorrente,
  DespesaRecorrenteCreate,
  DespesaRecorrenteUpdate,
} from '@/types/despesasRecorrentes';

import { formatCurrencyBR, formatDateBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash, Play, Pause, CalendarPlus } from 'lucide-react';

export default function DespesasRecorrentesPage() {
  const [despesas, setDespesas] = useState<DespesaRecorrente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<DespesaRecorrente | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [ordering, setOrdering] = useState('');
  const [showGerarMesAlert, setShowGerarMesAlert] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');

  const [showGerarProximosMesesDialog, setShowGerarProximosMesesDialog] = useState(false);
  const [despesaSelecionada, setDespesaSelecionada] = useState<DespesaRecorrente | null>(null);
  const [quantidadeMeses, setQuantidadeMeses] = useState(1);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // ======================
  // 🔄 LOAD DATA
  // ======================
  const loadDespesas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDespesasRecorrentes({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        ordering: ordering || undefined,
      });
      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar despesas recorrentes:', error);
      message.error('Erro ao buscar despesas recorrentes');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, ordering]);

  useEffect(() => {
    loadDespesas();
  }, [loadDespesas]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta despesa recorrente?')) return;

    try {
      await deleteDespesaRecorrente(id);
      toast.success('Despesa recorrente excluída com sucesso!');
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir despesa recorrente');
    }
  };

  // ======================
  // ❌ BULK DELETE
  // ======================
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos uma despesa recorrente');
      return;
    }

    if (!confirm(`Deseja realmente excluir ${selectedRowKeys.length} despesa(s) recorrente(s)?`)) return;

    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        selectedRowKeys.map((id) => deleteDespesaRecorrente(Number(id)))
      );

      toast.success(`${selectedRowKeys.length} despesa(s) recorrente(s) excluída(s) com sucesso`);
      setSelectedRowKeys([]);
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir despesas recorrentes');
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
  // 🔄 TOGGLE STATUS
  // ======================
  const handleToggleStatus = async (despesa: DespesaRecorrente) => {
    const novoStatus = despesa.status === 'A' ? 'P' : 'A';

    try {
      await updateDespesaRecorrente(despesa.id, { status: novoStatus });
      toast.success(
        novoStatus === 'A'
          ? 'Despesa reativada!'
          : 'Despesa pausada!'
      );
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status');
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (
    data: DespesaRecorrenteCreate | DespesaRecorrenteUpdate
  ) => {
    try {
      if (editingDespesa) {
        await updateDespesaRecorrente(
          editingDespesa.id,
          data as DespesaRecorrenteUpdate
        );
        toast.success('Despesa recorrente atualizada com sucesso!');
      } else {
        await createDespesaRecorrente(data as DespesaRecorrenteCreate);
        toast.success('Despesa recorrente criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingDespesa(null);
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar despesa recorrente');
      throw error;
    }
  };

  // ======================
  // 📅 GERAR MÊS
  // ======================
  const handleGerarMes = async () => {
    setShowGerarMesAlert(false);

    try {
      // Combinar mês e ano no formato YYYY-MM, se ambos estiverem preenchidos
      let mesFormatado: string | undefined = undefined;
      if (mesSelecionado && anoSelecionado) {
        mesFormatado = `${anoSelecionado}-${mesSelecionado.padStart(2, '0')}`;
      }

      const result = await gerarDespesasDoMes(mesFormatado);

      if (result.criadas > 0) {
        toast.success(
          `${result.criadas} despesa(s) gerada(s) para ${result.mes}!`
        );

        if (result.ignoradas > 0) {
          toast.info(`${result.ignoradas} já existiam e foram ignoradas`);
        }
      } else {
        toast.info('Nenhuma despesa foi gerada. Todas já existem.');
      }

      setMesSelecionado('');
      setAnoSelecionado('');
      loadDespesas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar despesas do mês');
    }
  };

  // ======================
  // 📅 GERAR PRÓXIMOS MESES
  // ======================
  const handleGerarProximosMeses = async () => {
    if (!despesaSelecionada) return;
    setShowGerarProximosMesesDialog(false);

    try {
      const result = await gerarProximosMeses(despesaSelecionada.id, quantidadeMeses);

      if (result.criadas > 0) {
        toast.success(
          `${result.criadas} despesa(s) gerada(s) para "${despesaSelecionada.nome}"!`
        );

        if (result.ignoradas > 0) {
          toast.info(`${result.ignoradas} meses foram ignorados`);
        }
      } else {
        toast.info('Nenhuma despesa foi gerada. Todas já existem ou estão fora do período.');
      }

      setQuantidadeMeses(1);
      setDespesaSelecionada(null);
      loadDespesas();
    } catch (error: unknown) {
      console.error(error);
      const err = error as { response?: { data?: { erro?: string } } };
      toast.error(err.response?.data?.erro || 'Erro ao gerar despesas');
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<DespesaRecorrente> = [
    {
      title: 'Nome',
      dataIndex: 'nome',
      width: '25%',
      sorter: true,
    },
    {
      title: 'Favorecido',
      dataIndex: 'responsavel__nome',
      width: '16%',
      sorter: true,
      render: (_: unknown, record: DespesaRecorrente) => (record.responsavel as { nome: string } | null)?.nome || '—',
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      width: '12%',
      sorter: true,
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo_display',
      width: '10%',
    },
    {
      title: 'Dia Venc.',
      dataIndex: 'dia_vencimento',
      width: '8%',
      render: (dia: number) => `Dia ${dia}`,
    },
    {
      title: 'Início',
      dataIndex: 'data_inicio',
      width: '10%',
      render: (data: string) =>
        formatDateBR(data),
    },
    {
      title: 'Status',
      dataIndex: 'status_display',
      width: '9%',
      render: (status: string, record: DespesaRecorrente) => (
        <span
          className={
            record.status === 'A'
              ? 'text-green-600 font-medium'
              : 'text-gray-400'
          }
        >
          {status}
        </span>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: DespesaRecorrente) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Gerar Próximos Meses',
              icon: CalendarPlus,
              onClick: () => {
                setDespesaSelecionada(record);
                setShowGerarProximosMesesDialog(true);
              },
            },
            {
              label: record.status === 'A' ? 'Pausar' : 'Reativar',
              icon: record.status === 'A' ? Pause : Play,
              onClick: () => handleToggleStatus(record),
            },
            { divider: true },
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

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Despesas Recorrentes
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar despesas recorrentes..."
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
              icon={<CalendarPlus className="w-4 h-4" />}
              onClick={() => setShowGerarMesAlert(true)}
              className="shadow-md bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Despesas do Mês
            </Button>

            <Button
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingDespesa(null);
                setOpenDialog(true);
              }}
            >
              Criar Despesa Recorrente
            </Button>
          </div>
        </div>

        <GenericTable<DespesaRecorrente>
          columns={columns}
          data={despesas}
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
          onSortChange={(o) => { setOrdering(o); setPage(1); }}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        <DespesaRecorrenteDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
            loadDespesas();
          }}
          onSubmit={handleSubmit}
          despesa={editingDespesa}
        />

        <AlertDialog open={showGerarMesAlert} onOpenChange={setShowGerarMesAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerar Despesas do Mês</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione o mês e ano para gerar as despesas recorrentes ativas.
                Deixe em branco para gerar o mês atual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Mês (opcional)
                  </label>
                  <select
                    value={mesSelecionado}
                    onChange={(e) => setMesSelecionado(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione</option>
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Ano (opcional)
                  </label>
                  <Input
                    type="number"
                    value={anoSelecionado}
                    onChange={(e) => setAnoSelecionado(e.target.value)}
                    placeholder="2024"
                    min="2000"
                    max="2099"
                  />
                </div>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setMesSelecionado('');
                setAnoSelecionado('');
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleGerarMes}
                className="bg-gold text-navy hover:bg-gold/90"
              >
                Gerar Despesas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={showGerarProximosMesesDialog}
          onOpenChange={setShowGerarProximosMesesDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerar Próximos Meses</AlertDialogTitle>
              <AlertDialogDescription>
                Gerar múltiplas despesas para &quot;{despesaSelecionada?.nome}&quot;
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Quantidade de meses (1-60)
                </label>
                <Input
                  placeholder="1"
                  value={quantidadeMeses}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    const num = parseInt(val) || 1;
                    setQuantidadeMeses(Math.max(1, Math.min(60, num)));
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Serão geradas {quantidadeMeses} despesa(s) a partir do mês atual.
                Despesas já existentes serão automaticamente ignoradas.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setQuantidadeMeses(1);
                setDespesaSelecionada(null);
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleGerarProximosMeses}
                className="bg-navy text-white hover:bg-navy/90"
              >
                Gerar Despesas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
