'use client';

import { useState } from 'react';
import { Modal, Form, DatePicker, Select, Button, Input, Checkbox } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { toast } from 'sonner';

interface RelatorioFiltrosModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (filtros: RelatorioFiltros) => Promise<void>;
  title: string;
  tipoRelatorio:
    | 'receitas-pagas'
    | 'despesas-pagas'
    | 'despesas-a-pagar'
    | 'receitas-a-receber'
    | 'dre-consolidado'
    | 'fluxo-de-caixa'
    | 'cliente-especifico'
    | 'funcionario-especifico';
  favorecidos?: Array<{ id: number; nome: string }>;
  clientes?: Array<{ id: number; nome: string }>;
  contas?: Array<{ id: number; nome: string }>;
}

export interface RelatorioFiltros {
  data_inicio?: string;
  data_fim?: string;
  responsavel_id?: number;
  funcionario_id?: number;
  cliente_id?: number;
  conta_bancaria_id?: number;
  tipo?: string;
  percentual_multa?: number | string;
  percentual_juros?: number | string;
  visualizacao?: 'ambas' | 'recebidas' | 'a_receber' | 'pagas' | 'a_pagar';
  incluir_custodias?: boolean;
}

// 🔹 Payload de recibo
export interface RelatorioReciboPayload {
  payment_id: number;
}

/** 🔹 Tipagem correta dos valores do formulário */
interface RelatorioFormValues {
  data_inicio?: Dayjs;
  data_fim?: Dayjs;
  responsavel_id?: number;
  cliente_id?: number;
  conta_bancaria_id?: number;
  tipo?: string;
  percentual_multa?: number | string;
  percentual_juros?: number | string;
  visualizacao?: 'ambas' | 'recebidas' | 'a_receber' | 'pagas' | 'a_pagar';
  incluir_custodias?: boolean;
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
  const [form] = Form.useForm<RelatorioFormValues>();
  const [loading, setLoading] = useState(false);

  // Determinar quais filtros mostrar baseado no tipo de relatório
  const mostrarFavorecido = ['despesas-pagas', 'despesas-a-pagar'].includes(tipoRelatorio);
  const mostrarCliente = ['receitas-pagas', 'receitas-a-receber'].includes(tipoRelatorio);
  const mostrarConta = tipoRelatorio === 'fluxo-de-caixa';
  const mostrarTipo = ['receitas-pagas', 'despesas-pagas', 'despesas-a-pagar', 'receitas-a-receber'].includes(tipoRelatorio);
  const mostrarDatas = !['cliente-especifico', 'funcionario-especifico'].includes(tipoRelatorio);
  const mostrarVisualizacao = ['cliente-especifico', 'funcionario-especifico'].includes(tipoRelatorio);
  const mostrarCustodias = ['cliente-especifico', 'funcionario-especifico'].includes(tipoRelatorio);

  const handleSubmit = async (values: RelatorioFormValues) => {
    try {
      setLoading(true);

      const filtros: RelatorioFiltros = {};

      if (values.data_inicio) {
        filtros.data_inicio = values.data_inicio.format('YYYY-MM-DD');
      }

      if (values.data_fim) {
        filtros.data_fim = values.data_fim.format('YYYY-MM-DD');
      }

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

      if (values.percentual_multa !== undefined && values.percentual_multa !== null) {
        const multa = typeof values.percentual_multa === 'string'
          ? parseFloat(values.percentual_multa.replace(',', '.'))
          : values.percentual_multa;
        filtros.percentual_multa = multa;
      }

      if (values.percentual_juros !== undefined && values.percentual_juros !== null) {
        const juros = typeof values.percentual_juros === 'string'
          ? parseFloat(values.percentual_juros.replace(',', '.'))
          : values.percentual_juros;
        filtros.percentual_juros = juros;
      }

      if (values.visualizacao) {
        filtros.visualizacao = values.visualizacao;
      }

      if (values.incluir_custodias !== undefined) {
        filtros.incluir_custodias = values.incluir_custodias;
      }

      await onGenerate(filtros);
      form.resetFields();
      onClose();
    } catch (error: unknown) {
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
              ]}
            />
          </Form.Item>
        )}

        {mostrarDatas && (
          <>
            <Form.Item
              name="data_inicio"
              label="Data Inicial"
              tooltip="Deixe em branco para sem limite"
            >
              <DatePicker
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
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}

        {mostrarVisualizacao && (
          <Form.Item
            name="visualizacao"
            label="Visualização"
            tooltip="Escolha quais contas deseja ver no relatório"
            initialValue="ambas"
          >
            <Select
              placeholder="Selecione o tipo de visualização"
              options={
                tipoRelatorio === 'cliente-especifico'
                  ? [
                      { value: 'ambas', label: 'Ambas (Recebidas e A Receber)' },
                      { value: 'recebidas', label: 'Apenas Contas Recebidas' },
                      { value: 'a_receber', label: 'Apenas Contas a Receber' },
                    ]
                  : [
                      { value: 'ambas', label: 'Ambas (Pagas e A Pagar)' },
                      { value: 'pagas', label: 'Apenas Despesas Pagas' },
                      { value: 'a_pagar', label: 'Apenas Despesas a Pagar' },
                    ]
              }
            />
          </Form.Item>
        )}

        {tipoRelatorio === 'cliente-especifico' && (
          <>
            <Form.Item
              name="percentual_multa"
              label="% Multa"
              tooltip="Percentual de multa para contas em atraso"
              initialValue={0}
            >
              <Input
                placeholder="Ex: 2,00 (para 2%)"
                suffix="%"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="percentual_juros"
              label="% Juros (mensal)"
              tooltip="Percentual de juros mensal para contas em atraso"
              initialValue={0}
            >
              <Input
                placeholder="Ex: 1,00 (para 1% ao mês)"
                suffix="%"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}

        {mostrarCustodias && (
          <Form.Item
            name="incluir_custodias"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox>
              Incluir custódias no relatório
            </Checkbox>
          </Form.Item>
        )}

        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-700">
          💡 <strong>Dica:</strong> Deixe os filtros em branco para gerar o relatório sem restrições.
        </div>
      </Form>
    </Modal>
  );
}
