'use client';

import { useState } from 'react';
import { Modal, Form, DatePicker, Select, Button, Space, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { toast } from 'sonner';

interface RelatorioFiltrosModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (filtros: RelatorioFiltros) => Promise<void>;
  title: string;
  tipoRelatorio: 'receitas-pagas' | 'despesas-pagas' | 'despesas-a-pagar' | 'receitas-a-receber' | 'dre-consolidado' | 'fluxo-de-caixa' | 'cliente-especifico';
  favorecidos?: Array<{ id: number; nome: string }>;
  clientes?: Array<{ id: number; nome: string }>;
  contas?: Array<{ id: number; nome: string }>;
}

export interface RelatorioFiltros {
  data_inicio?: string;
  data_fim?: string;
  responsavel_id?: number;
  cliente_id?: number;
  conta_bancaria_id?: number;
  tipo?: string;
}

export default function RelatorioFiltrosModal({
  open,
  onClose,
  onGenerate,
  title,
  tipoRelatorio,
  favorecidos = [],
  clientes = [],
  contas = [],
}: RelatorioFiltrosModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Determinar quais filtros mostrar baseado no tipo de relatório
  const mostrarFavorecido = ['despesas-pagas', 'despesas-a-pagar'].includes(tipoRelatorio);
  const mostrarCliente = ['receitas-pagas', 'receitas-a-receber', 'cliente-especifico'].includes(tipoRelatorio);
  const mostrarConta = tipoRelatorio === 'fluxo-de-caixa';
  const mostrarTipo = ['receitas-pagas', 'despesas-pagas', 'despesas-a-pagar', 'receitas-a-receber'].includes(tipoRelatorio);
  const mostrarDatas = tipoRelatorio !== 'cliente-especifico';

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const filtros: RelatorioFiltros = {};

      // Adicionar datas se fornecidas
      if (values.data_inicio) {
        filtros.data_inicio = values.data_inicio.format('YYYY-MM-DD');
      }
      if (values.data_fim) {
        filtros.data_fim = values.data_fim.format('YYYY-MM-DD');
      }

      // Adicionar outros filtros
      if (values.responsavel_id) {
        filtros.responsavel_id = values.responsavel_id;
      }
      if (values.cliente_id) {
        filtros.cliente_id = values.cliente_id;
      }
      if (values.conta_bancaria_id) {
        filtros.conta_bancaria_id = values.conta_bancaria_id;
      }
      if (values.tipo) {
        filtros.tipo = values.tipo;
      }

      await onGenerate(filtros);
      form.resetFields();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={`${title} - Filtros`}
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancelar
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          icon={<DownloadOutlined />}
          onClick={() => form.submit()}
        >
          Gerar PDF
        </Button>,
      ]}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        {/* Filtro de Cliente */}
        {mostrarCliente && (
          <Form.Item
            name="cliente_id"
            label="Cliente"
            tooltip="Deixe em branco para todos os clientes"
          >
            <Select
              placeholder="Selecione um cliente (opcional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={clientes.map((c) => ({
                value: c.id,
                label: c.nome,
              }))}
            />
          </Form.Item>
        )}

        {/* Filtro de Favorecido */}
        {mostrarFavorecido && (
          <Form.Item
            name="responsavel_id"
            label="Favorecido"
            tooltip="Deixe em branco para todos os favorecidos"
          >
            <Select
              placeholder="Selecione um favorecido (opcional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={favorecidos.map((f) => ({
                value: f.id,
                label: f.nome,
              }))}
            />
          </Form.Item>
        )}

        {/* Filtro de Conta Bancária */}
        {mostrarConta && (
          <Form.Item
            name="conta_bancaria_id"
            label="Conta Bancária"
            tooltip="Deixe em branco para consolidado"
          >
            <Select
              placeholder="Selecione uma conta (opcional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={contas.map((c) => ({
                value: c.id,
                label: c.nome,
              }))}
            />
          </Form.Item>
        )}

        {/* Filtro de Tipo */}
        {mostrarTipo && (
          <Form.Item
            name="tipo"
            label="Tipo"
            tooltip="Deixe em branco para todos os tipos"
          >
            <Select
              placeholder="Selecione um tipo (opcional)"
              allowClear
              options={[
                { value: 'F', label: 'Fixa' },
                { value: 'V', label: 'Variável' },
                ...(tipoRelatorio.includes('despesa')
                  ? [
                      { value: 'C', label: 'Comissão' },
                      { value: 'R', label: 'Reembolso' },
                    ]
                  : []),
                ...(tipoRelatorio.includes('estorno')
                  ? [{ value: 'E', label: 'Estorno' }]
                  : []),
              ]}
            />
          </Form.Item>
        )}

        {/* Filtro de Datas */}
        {mostrarDatas && (
          <>
            <Form.Item
              name="data_inicio"
              label="Data Inicial"
              tooltip="Deixe em branco para sem limite"
            >
              <DatePicker
                placeholder="Selecione a data inicial"
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="data_fim"
              label="Data Final"
              tooltip="Deixe em branco para até hoje"
            >
              <DatePicker
                placeholder="Selecione a data final"
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}

        {/* Mensagem de ajuda */}
        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-700">
          💡 <strong>Dica:</strong> Deixe os filtros em branco para gerar o relatório sem restrições.
        </div>
      </Form>
    </Modal>
  );
}
