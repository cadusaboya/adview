'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import ReceitaRecorrenteDialog from '@/components/dialogs/ReceitaRecorrenteDialog';
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
  getReceitasRecorrentes,
  createReceitaRecorrente,
  updateReceitaRecorrente,
  deleteReceitaRecorrente,
  gerarReceitasDoMes,
  gerarProximosMeses,
} from '@/services/receitasRecorrentes';

import {
  ReceitaRecorrente,
  ReceitaRecorrenteCreate,
  ReceitaRecorrenteUpdate,
} from '@/types/receitasRecorrentes';

import { formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash, Play, Pause, CalendarPlus } from 'lucide-react';

export default function ReceitasRecorrentesPage() {
  const [receitas, setReceitas] = useState<ReceitaRecorrente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<ReceitaRecorrente | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showGerarMesAlert, setShowGerarMesAlert] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState('');

  const [showGerarProximosMesesDialog, setShowGerarProximosMesesDialog] = useState(false);
  const [receitaSelecionada, setReceitaSelecionada] = useState<ReceitaRecorrente | null>(null);
  const [quantidadeMeses, setQuantidadeMeses] = useState(1);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ======================
  // 🔄 LOAD DATA
  // ======================
  const loadReceitas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getReceitasRecorrentes({
        page,
        page_size: pageSize,
        search: debouncedSearch,
      });
      setReceitas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar receitas recorrentes:', error);
      message.error('Erro ao buscar receitas recorrentes');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadReceitas();
  }, [loadReceitas]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta receita recorrente?')) return;

    try {
      await deleteReceitaRecorrente(id);
      toast.success('Receita recorrente excluída com sucesso!');
      loadReceitas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir receita recorrente');
    }
  };

  // ======================
  // 🔄 TOGGLE STATUS
  // ======================
  const handleToggleStatus = async (receita: ReceitaRecorrente) => {
    const novoStatus = receita.status === 'A' ? 'P' : 'A';

    try {
      await updateReceitaRecorrente(receita.id, { status: novoStatus });
      toast.success(
        novoStatus === 'A'
          ? 'Receita reativada!'
          : 'Receita pausada!'
      );
      loadReceitas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status');
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (
    data: ReceitaRecorrenteCreate | ReceitaRecorrenteUpdate
  ) => {
    try {
      if (editingReceita) {
        await updateReceitaRecorrente(
          editingReceita.id,
          data as ReceitaRecorrenteUpdate
        );
        toast.success('Receita recorrente atualizada com sucesso!');
      } else {
        await createReceitaRecorrente(data as ReceitaRecorrenteCreate);
        toast.success('Receita recorrente criada com sucesso!');
      }

      setOpenDialog(false);
      setEditingReceita(null);
      loadReceitas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar receita recorrente');
      throw error;
    }
  };

  // ======================
  // 📅 GERAR MÊS
  // ======================
  const handleGerarMes = async () => {
    setShowGerarMesAlert(false);

    try {
      const result = await gerarReceitasDoMes(mesSelecionado || undefined);

      if (result.criadas > 0) {
        toast.success(
          `${result.criadas} receita(s) gerada(s) para ${result.mes}!`
        );

        if (result.ignoradas > 0) {
          toast.info(`${result.ignoradas} já existiam e foram ignoradas`);
        }
      } else {
        toast.info('Nenhuma receita foi gerada. Todas já existem.');
      }

      setMesSelecionado('');
      loadReceitas();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar receitas do mês');
    }
  };

  // ======================
  // 📅 GERAR PRÓXIMOS MESES
  // ======================
  const handleGerarProximosMeses = async () => {
    if (!receitaSelecionada) return;
    setShowGerarProximosMesesDialog(false);

    try {
      const result = await gerarProximosMeses(receitaSelecionada.id, quantidadeMeses);

      if (result.criadas > 0) {
        toast.success(
          `${result.criadas} receita(s) gerada(s) para "${receitaSelecionada.nome}"!`
        );

        if (result.ignoradas > 0) {
          toast.info(`${result.ignoradas} meses foram ignorados`);
        }
      } else {
        toast.info('Nenhuma receita foi gerada. Todas já existem ou estão fora do período.');
      }

      setQuantidadeMeses(1);
      setReceitaSelecionada(null);
      loadReceitas();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.erro || 'Erro ao gerar receitas');
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<ReceitaRecorrente> = [
    {
      title: 'Nome',
      dataIndex: 'nome',
      width: '25%',
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente',
      width: '20%',
      render: (c: { nome: string }) => c?.nome || '—',
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
      render: (status: string, record: ReceitaRecorrente) => (
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
      render: (_: unknown, record: ReceitaRecorrente) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Gerar Próximos Meses',
              icon: CalendarPlus,
              onClick: () => {
                setReceitaSelecionada(record);
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

      <main className="bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Receitas Recorrentes
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar receitas recorrentes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80"
            />

            <Button
              icon={<CalendarPlus className="w-4 h-4" />}
              onClick={() => setShowGerarMesAlert(true)}
              className="shadow-md bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Receitas do Mês
            </Button>

            <Button
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingReceita(null);
                setOpenDialog(true);
              }}
            >
              Criar Receita Recorrente
            </Button>
          </div>
        </div>

        <GenericTable<ReceitaRecorrente>
          columns={columns}
          data={receitas}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => setPage(p),
          }}
        />

        <ReceitaRecorrenteDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingReceita(null);
            loadReceitas();
          }}
          onSubmit={handleSubmit}
          receita={editingReceita}
        />

        <AlertDialog open={showGerarMesAlert} onOpenChange={setShowGerarMesAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerar Receitas do Mês</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione o mês para gerar as receitas recorrentes ativas.
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
                Gerar Receitas
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
                Gerar múltiplas receitas para "{receitaSelecionada?.nome}"
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
                Serão geradas {quantidadeMeses} receita(s) a partir do mês atual.
                Receitas já existentes serão automaticamente ignoradas.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setQuantidadeMeses(1);
                setReceitaSelecionada(null);
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleGerarProximosMeses}
                className="bg-navy text-white hover:bg-navy/90"
              >
                Gerar Receitas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
