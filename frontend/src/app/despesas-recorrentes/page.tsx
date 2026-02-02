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

import { formatCurrencyBR } from '@/lib/formatters';
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
  const [showGerarMesAlert, setShowGerarMesAlert] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState('');

  const [showGerarProximosMesesDialog, setShowGerarProximosMesesDialog] = useState(false);
  const [despesaSelecionada, setDespesaSelecionada] = useState<DespesaRecorrente | null>(null);
  const [quantidadeMeses, setQuantidadeMeses] = useState(1);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
      });
      setDespesas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar despesas recorrentes:', error);
      message.error('Erro ao buscar despesas recorrentes');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadDespesas();
  }, [loadDespesas]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
      const result = await gerarDespesasDoMes(mesSelecionado || undefined);

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
    },
    {
      title: 'Favorecido',
      dataIndex: 'responsavel',
      width: '20%',
      render: (r: { nome: string }) => r?.nome || '—',
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      width: '12%',
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
        new Date(data).toLocaleDateString('pt-BR'),
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

      <main className="bg-muted min-h-screen w-full p-6">
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
          }}
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
                Selecione o mês para gerar as despesas recorrentes ativas.
                Deixe em branco para gerar o mês atual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Mês (opcional)
              </label>
              <Input
                type="month"
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                placeholder="Selecione o mês"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMesSelecionado('')}>
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
                  Quantidade de meses (1-24)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={quantidadeMeses}
                  onChange={(e) => setQuantidadeMeses(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
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
