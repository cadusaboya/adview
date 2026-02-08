"use client";

import { useEffect, useState, useCallback } from "react";

import {
  getBancos,
  createBanco,
  updateBanco,
  deleteBanco,
} from "@/services/bancos";

import { Banco, BancoCreate, BancoUpdate } from "@/types/bancos";
import { Transfer, TransferCreate, TransferUpdate, TRANSFER_STATUS_COLORS } from "@/types/transfer";
import { transfersService } from "@/services/transfers";

import { Button, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { toast } from "sonner";

import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import BancoDialog from "@/components/dialogs/BancoDialog";
import TransferDialog from "@/components/dialogs/TransferDialog";

import { formatCurrencyBR } from "@/lib/formatters";
import { ActionsDropdown } from "@/components/imports/ActionsDropdown";
import { Pencil, Trash, ArrowRightLeft } from "lucide-react";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { DeleteConfirmationDialog } from "@/components/dialogs/DeleteConfirmationDialog";

export default function BancosPage() {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Transfer state
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [openTransferDialog, setOpenTransferDialog] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);

  // ======================
  // 🔄 LOAD
  // ======================
  const loadBancos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBancos({ page_size: 100000 });
      setBancos(res.results);
    } catch (error: unknown) {
      console.error("Erro ao buscar contas bancárias:", error);
      toast.error("Erro ao buscar contas bancárias");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try {
      const res = await transfersService.list({ page_size: 1000 });
      setTransfers(res.results);
    } catch (error: unknown) {
      console.error("Erro ao buscar transferências:", error);
      toast.error("Erro ao buscar transferências");
    } finally {
      setLoadingTransfers(false);
    }
  }, []);

  useEffect(() => {
    loadBancos();
    loadTransfers();
  }, [loadBancos, loadTransfers]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDeleteAction = async (id: number) => {
    try {
      await deleteBanco(id);
      toast.success("Conta bancária excluída com sucesso!");
      loadBancos();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao excluir conta bancária");
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteBanco(id))
      );

      toast.success(`${ids.length} conta(s) bancária(s) excluída(s) com sucesso`);
      setSelectedRowKeys([]);
      loadBancos();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao excluir contas bancárias");
    } finally {
      setLoading(false);
    }
  };

  const {
    confirmState,
    confirmDelete,
    confirmBulkDelete,
    handleConfirm,
    handleCancel,
  } = useDeleteConfirmation({
    onDelete: handleDeleteAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDelete = (id: number) => {
    const banco = bancos.find((b) => b.id === id);
    confirmDelete(id, banco?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error("Selecione pelo menos uma conta bancária");
      return;
    }
    confirmBulkDelete(selectedRowKeys.map(Number));
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
  const handleSubmit = async (data: BancoCreate | BancoUpdate) => {
    try {
      if (editingBanco) {
        // UPDATE → pode ser parcial
        await updateBanco(editingBanco.id, data as BancoUpdate);
        toast.success("Conta bancária atualizada com sucesso!");
      } else {
        // CREATE → payload obrigatório
        await createBanco(data as BancoCreate);
        toast.success("Conta bancária criada com sucesso!");
      }

      setOpenDialog(false);
      setEditingBanco(null);
      loadBancos();
    } catch (error: unknown) {
      console.error("Erro ao salvar conta bancária:", error);
      toast.error("Erro ao salvar conta bancária");
    }
  };

  // ======================
  // 💾 CREATE / UPDATE TRANSFER
  // ======================
  const handleTransferSubmit = async (data: TransferCreate | TransferUpdate) => {
    try {
      if (editingTransfer) {
        await transfersService.update(editingTransfer.id, data as TransferUpdate);
        toast.success("Transferência atualizada com sucesso!");
      } else {
        await transfersService.create(data as TransferCreate);
        toast.success("Transferência criada com sucesso!");
      }

      setOpenTransferDialog(false);
      setEditingTransfer(null);
      loadTransfers();
    } catch (error: unknown) {
      console.error("Erro ao salvar transferência:", error);
      toast.error("Erro ao salvar transferência");
    }
  };

  // ======================
  // ❌ DELETE TRANSFER
  // ======================
  const handleDeleteTransferAction = async (id: number) => {
    try {
      await transfersService.delete(id);
      toast.success("Transferência excluída com sucesso!");
      loadTransfers();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao excluir transferência");
    }
  };

  const {
    confirmState: transferConfirmState,
    confirmDelete: confirmDeleteTransfer,
    handleConfirm: handleConfirmTransfer,
    handleCancel: handleCancelTransfer,
  } = useDeleteConfirmation({
    onDelete: handleDeleteTransferAction,
  });

  const handleDeleteTransfer = (id: number) => {
    const transfer = transfers.find((t) => t.id === id);
    const transferName = transfer ? `${formatCurrencyBR(transfer.valor)} de ${transfer.from_bank_nome} para ${transfer.to_bank_nome}` : undefined;
    confirmDeleteTransfer(id, transferName);
  };

  // ======================
  // 📊 TABELA BANCOS
  // ======================
  const columns: TableColumnsType<Banco> = [
    {
      title: "Nome",
      dataIndex: "nome",
      width: "15%",
    },
    {
      title: "Descrição",
      dataIndex: "descricao",
      width: "40%",
    },
    {
      title: "Saldo Atual",
      dataIndex: "saldo_atual",
      width: "20%",
      render: (value: number) => formatCurrencyBR(value),
    },
    {
      title: "Ações",
      key: "actions",
      width: "6%",
      render: (_: unknown, record: Banco) => (
        <ActionsDropdown
          actions={[
            {
              label: "Editar",
              icon: Pencil,
              onClick: () => {
                setEditingBanco(record);
                setOpenDialog(true);
              },
            },
            {
              label: "Excluir",
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
  // 📊 TABELA TRANSFERS
  // ======================
  const transferColumns: TableColumnsType<Transfer> = [
    {
      title: "Data",
      dataIndex: "data_transferencia",
      width: "12%",
      render: (date: string) => new Date(date).toLocaleDateString("pt-BR"),
    },
    {
      title: "De",
      dataIndex: "from_bank_nome",
      width: "18%",
    },
    {
      title: "",
      key: "arrow",
      width: "5%",
      render: () => <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />,
    },
    {
      title: "Para",
      dataIndex: "to_bank_nome",
      width: "18%",
    },
    {
      title: "Valor",
      dataIndex: "valor",
      width: "15%",
      render: (value: string) => formatCurrencyBR(parseFloat(value)),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: "12%",
      render: (status: string, record: Transfer) => (
        <Tag className={TRANSFER_STATUS_COLORS[status as keyof typeof TRANSFER_STATUS_COLORS]}>
          {record.status_display}
        </Tag>
      ),
    },
    {
      title: "Saída",
      dataIndex: "valor_saida",
      width: "10%",
      render: (value: string) => formatCurrencyBR(parseFloat(value)),
    },
    {
      title: "Entrada",
      dataIndex: "valor_entrada",
      width: "10%",
      render: (value: string) => formatCurrencyBR(parseFloat(value)),
    },
    {
      title: "Ações",
      key: "actions",
      width: "6%",
      render: (_: unknown, record: Transfer) => (
        <ActionsDropdown
          actions={[
            {
              label: "Editar",
              icon: Pencil,
              onClick: () => {
                setEditingTransfer(record);
                setOpenTransferDialog(true);
              },
            },
            {
              label: "Excluir",
              icon: Trash,
              danger: true,
              onClick: () => handleDeleteTransfer(record.id),
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
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Contas Bancárias</h1>

          <div className="flex gap-2">
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
                setEditingBanco(null);
                setOpenDialog(true);
              }}
            >
              Criar Conta Bancária
            </Button>
          </div>
        </div>

        <GenericTable<Banco>
          columns={columns}
          data={bancos}
          loading={loading}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        {/* Seção de Transferências */}
        <div className="mt-8">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-serif font-bold text-navy">Transferências entre Contas</h2>
            <Button
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingTransfer(null);
                setOpenTransferDialog(true);
              }}
              icon={<ArrowRightLeft className="w-4 h-4" />}
            >
              Nova Transferência
            </Button>
          </div>

          <GenericTable<Transfer>
            columns={transferColumns}
            data={transfers}
            loading={loadingTransfers}
            rowKey="id"
          />
        </div>

        <BancoDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingBanco(null);
            loadBancos(); // Refetch para atualizar mudanças
          }}
          onSubmit={handleSubmit}
          banco={editingBanco}
        />

        <TransferDialog
          open={openTransferDialog}
          onClose={() => {
            setOpenTransferDialog(false);
            setEditingTransfer(null);
          }}
          onSubmit={handleTransferSubmit}
          transfer={editingTransfer}
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir contas bancárias selecionadas?' : 'Excluir conta bancária?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />

        <DeleteConfirmationDialog
          open={transferConfirmState.isOpen}
          onConfirm={handleConfirmTransfer}
          onCancel={handleCancelTransfer}
          title="Excluir transferência?"
          itemName={transferConfirmState.itemName}
          isBulk={false}
          itemCount={0}
        />
      </main>
    </div>
  );
}
