'use client';

import { useEffect, useState } from 'react';
import {
  getClientes,
  Cliente,
  deleteCliente,
  createCliente,
  updateCliente,
} from '@/services/clientes';

import { Button } from 'antd';
import GenericTable from '@/components/imports/GenericTable';
import type { TableColumnsType } from 'antd';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import ClienteDialog from '@/components/dialogs/ClienteDialog';
import { ClienteProfileDialog } from '@/components/dialogs/ClienteProfileDialog';
import { gerarRelatorioPDF } from '@/services/pdf';
import { toast } from 'sonner';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import {
  Pencil,
  Trash,
  FileText,
  DollarSign,
} from 'lucide-react';

export default function ClientePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  // 📊 loading individual do relatório
  const [loadingRelatorio, setLoadingRelatorio] = useState<number | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ======================
  // 🔄 LOAD
  // ======================
  const loadClientes = async () => {
    try {
      setLoading(true);
      const res = await getClientes({ page, page_size: pageSize });
      setClientes(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, [page]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return;

    try {
      await deleteCliente(id);
      toast.success('Cliente excluído com sucesso');
      loadClientes();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir cliente');
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (data: any) => {
    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, data);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await createCliente(data);
        toast.success('Cliente criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingCliente(null);
      loadClientes();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente');
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (clienteId: number) => {
    try {
      setLoadingRelatorio(clienteId);

      await gerarRelatorioPDF('cliente-especifico', {
        cliente_id: clienteId,
      });

      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao gerar relatório');
    } finally {
      setLoadingRelatorio(null);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Cliente> = [
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'CPF / CNPJ', dataIndex: 'cpf' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Tipo', dataIndex: 'tipo_display' },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: Cliente) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Financeiro',
              icon: DollarSign,
              onClick: () => {
                // Dialog encapsulado
                document.getElementById(`cliente-fin-${record.id}`)?.click();
              },
            },
            {
              label: 'Gerar PDF',
              icon: FileText,
              onClick: () => handleGerarRelatorio(record.id),
              disabled: loadingRelatorio === record.id,
            },
            { divider: true },
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingCliente(record);
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
        <div className="flex justify-end mb-4">
          <Button
            className="shadow-md"
            onClick={() => {
              setEditingCliente(null);
              setOpenDialog(true);
            }}
          >
            Criar Cliente
          </Button>
        </div>

        <GenericTable<Cliente>
          columns={columns}
          data={clientes}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (page) => setPage(page),
          }}
        />

        {/* 🔹 DIALOG CRIAR / EDITAR */}
        <ClienteDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingCliente(null);
          }}
          onSubmit={handleSubmit}
          cliente={editingCliente}
        />

        {/* 🔹 DIALOG FINANCEIRO (um por linha, invisível) */}
        {clientes.map((cliente) => (
          <ClienteProfileDialog key={cliente.id} clientId={cliente.id}>
            <button
              id={`cliente-fin-${cliente.id}`}
              className="hidden"
            />
          </ClienteProfileDialog>
        ))}
      </main>
    </div>
  );
}
