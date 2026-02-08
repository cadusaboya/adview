'use client';

import { useState } from 'react';
import { Modal, Button, Select, message, Card, Radio } from 'antd';
import { toast } from 'sonner';
import {
  conciliarBancario,
  confirmarSugestao,
  ConciliacaoBancariaResponse,
  SugestaoMatch
} from '@/services/payments';
import { formatCurrencyBR, formatDateBR } from '@/lib/formatters';

interface ConciliacaoBancariaDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const ANOS = Array.from({ length: 5 }, (_, i) => {
  const ano = new Date().getFullYear() - 2 + i;
  return { value: ano, label: String(ano) };
});

export default function ConciliacaoBancariaDialog({
  open,
  onClose,
  onSuccess,
}: ConciliacaoBancariaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [resultado, setResultado] = useState<ConciliacaoBancariaResponse | null>(null);
  const [sugestoesState, setSugestoesState] = useState<SugestaoMatch[]>([]);
  const [selecoes, setSelecoes] = useState<Record<number, number | null>>({});  // payment_id -> entidade_id
  const [tipoSelecoes, setTipoSelecoes] = useState<Record<number, string>>({});  // payment_id -> tipo
  const [confirmandoSugestoes, setConfirmandoSugestoes] = useState(false);

  const handleClose = () => {
    setResultado(null);
    setSugestoesState([]);
    setSelecoes({});
    setTipoSelecoes({});
    onClose();
  };

  const handleSelecionarOpcao = (paymentId: number, entidadeId: number, tipo: string) => {
    setSelecoes((prev) => ({ ...prev, [paymentId]: entidadeId }));
    setTipoSelecoes((prev) => ({ ...prev, [paymentId]: tipo }));
  };

  const handleConfirmarSugestoes = async () => {
    const sugestoesParaConfirmar = Object.entries(selecoes).filter(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([_, entidadeId]) => entidadeId !== null
    );

    if (sugestoesParaConfirmar.length === 0) {
      message.warning('Selecione pelo menos uma sugestão para confirmar');
      return;
    }

    try {
      setConfirmandoSugestoes(true);
      let sucessos = 0;
      let erros = 0;

      for (const [paymentIdStr, entidadeId] of sugestoesParaConfirmar) {
        const paymentId = Number(paymentIdStr);
        const tipo = tipoSelecoes[paymentId] as 'receita' | 'despesa' | 'custodia';

        if (!tipo || entidadeId === null) {
          continue;
        }

        try {
          await confirmarSugestao(paymentId, tipo, entidadeId);
          sucessos++;
        } catch (error) {
          console.error(`Erro ao confirmar sugestão para payment ${paymentId}:`, error);
          erros++;
        }
      }

      if (sucessos > 0) {
        toast.success(`${sucessos} sugestão(ões) confirmada(s) com sucesso!`);
        onSuccess();
      }

      if (erros > 0) {
        toast.error(`${erros} erro(s) ao confirmar sugestões`);
      }

      // Remove as sugestões confirmadas da lista
      setSugestoesState((prev) =>
        prev.filter((s) => !selecoes[s.payment_id])
      );
      setSelecoes({});
      setTipoSelecoes({});

    } catch (error) {
      console.error('Erro ao confirmar sugestões:', error);
      toast.error('Erro ao confirmar sugestões');
    } finally {
      setConfirmandoSugestoes(false);
    }
  };

  const handleConciliar = async () => {
    try {
      setLoading(true);
      const res = await conciliarBancario(mes, ano);
      setResultado(res);
      setSugestoesState(res.sugestoes || []);

      if (res.matches.total > 0) {
        toast.success(
          `Conciliação concluída! ${res.matches.total} vínculo(s) criado(s) automaticamente.`
        );
        onSuccess();
      } else {
        message.info('Nenhum vínculo foi criado automaticamente.');
      }

      if (res.total_sugestoes > 0) {
        message.info(
          `${res.total_sugestoes} pagamento(s) com sugestões de vínculo. Revise ao lado.`,
          5
        );
      }
    } catch (error: unknown) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string } } };
      const errorMsg = err?.response?.data?.error || 'Erro ao realizar conciliação bancária';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Conciliação Bancária"
      open={open}
      onCancel={handleClose}
      width={sugestoesState.length > 0 ? 1200 : 600}
      footer={
        resultado ? (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {sugestoesState.length > 0 && (
                `${sugestoesState.length} sugestão(ões) pendente(s)`
              )}
            </span>
            <Button type="primary" onClick={handleClose}>
              {sugestoesState.length > 0 ? 'Fechar (Revisar depois)' : 'Fechar'}
            </Button>
          </div>
        ) : (
          <>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button
              type="primary"
              onClick={handleConciliar}
              loading={loading}
              className="bg-navy hover:bg-navy/90"
            >
              Conciliar
            </Button>
          </>
        )
      }
    >
      {!resultado ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecione o mês e ano para realizar a conciliação automática. O sistema irá vincular
            pagamentos sem alocação às receitas, despesas e custódias em aberto, <strong>apenas quando
            AMBAS as condições forem satisfeitas</strong>: valor exato E o nome da contraparte
            (cliente/responsável) está contido na observação do pagamento.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mês</label>
              <Select
                value={mes}
                onChange={setMes}
                options={MESES}
                className="w-full"
                size="large"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ano</label>
              <Select
                value={ano}
                onChange={setAno}
                options={ANOS}
                className="w-full"
                size="large"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-blue-900 mb-2">Regras de Conciliação:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Pagamentos de <strong>Entrada</strong> serão vinculados a <strong>Receitas</strong> ou <strong>Custódias Ativo</strong></li>
              <li>Pagamentos de <strong>Saída</strong> serão vinculados a <strong>Despesas</strong> ou <strong>Custódias Passivo</strong></li>
              <li><strong>⚠️ Condições OBRIGATÓRIAS</strong>: O match requer <strong>valor exato</strong> E o <strong>nome da contraparte</strong> na <strong>observação</strong></li>
              <li>Apenas itens em <strong>aberto</strong> serão considerados</li>
              <li>Sem o nome na observação, o pagamento <strong>NÃO será vinculado automaticamente</strong></li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* COLUNA ESQUERDA: RESULTADO */}
          <div className={sugestoesState.length > 0 ? "w-1/2" : "w-full"}>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-4">Resultado da Conciliação</h4>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-gray-700 font-medium">Mês/Ano:</span>
                  <span className="font-semibold text-gray-900">
                    {MESES.find(m => m.value === resultado.mes)?.label}/{resultado.ano}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-gray-700">Quantidade de Pagamentos Processados:</span>
                  <span className="font-semibold text-gray-900">{resultado.total_payments_processados}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-gray-700">Quantidade de Vínculos criados automaticamente:</span>
                  <span className="font-semibold text-green-700">{resultado.matches.total}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-gray-700">Quantidade de Sugestões de Vínculo:</span>
                  <span className="font-semibold text-yellow-700">{resultado.total_sugestoes || 0}</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700">Quantidade de Pagamentos sem Vínculo:</span>
                  <span className="font-semibold text-gray-900">
                    {resultado.total_payments_processados - resultado.matches.total - (resultado.total_sugestoes || 0)}
                  </span>
                </div>
              </div>

              {resultado.erros && resultado.erros.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <p className="text-xs font-medium text-red-700 mb-2">⚠️ Avisos ({resultado.erros.length}):</p>
                  <div className="text-xs text-red-600 max-h-32 overflow-y-auto">
                    {resultado.erros.slice(0, 3).map((erro, idx) => (
                      <div key={idx} className="mb-1">• {erro}</div>
                    ))}
                    {resultado.erros.length > 3 && (
                      <div className="text-gray-600 italic">... e mais {resultado.erros.length - 3} avisos</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: SUGESTÕES */}
          {sugestoesState.length > 0 && (
            <div className="w-1/2">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-yellow-900 mb-2">
                  💡 Sugestões de Vínculo ({sugestoesState.length})
                </h4>
                <p className="text-sm text-yellow-800">
                  Os pagamentos abaixo têm <strong>valor compatível</strong> mas o <strong>nome da contraparte não foi encontrado</strong> na observação.
                  Revise manualmente e selecione a opção correta para confirmar o vínculo.
                </p>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {sugestoesState.map((sugestao) => (
                  <Card
                    key={sugestao.payment_id}
                    size="small"
                    className="border-yellow-300"
                  >
                    <div className="mb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-gray-900">
                            Pagamento #{sugestao.payment_id}
                          </span>
                          <span className="mx-2 text-gray-400">•</span>
                          <span className={`font-semibold ${
                            sugestao.payment_tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrencyBR(parseFloat(sugestao.payment_valor))}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDateBR(sugestao.payment_data)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <div><strong>Conta:</strong> {sugestao.payment_conta}</div>
                        {sugestao.payment_observacao && (
                          <div className="bg-gray-50 p-2 rounded">
                            <strong>Observação:</strong> {sugestao.payment_observacao}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        Selecione a opção correta:
                      </p>
                      <Radio.Group
                        value={selecoes[sugestao.payment_id]}
                        onChange={(e) =>
                          handleSelecionarOpcao(
                            sugestao.payment_id,
                            e.target.value,
                            sugestao.opcoes.find((o) => o.entidade_id === e.target.value)?.tipo || ''
                          )
                        }
                        className="w-full"
                      >
                        <div className="space-y-2">
                          {sugestao.opcoes.map((opcao) => (
                            <Radio
                              key={`${opcao.tipo}-${opcao.entidade_id}`}
                              value={opcao.entidade_id}
                              className="w-full"
                            >
                              <div className="text-xs">
                                <span className="font-medium capitalize">{opcao.tipo}:</span>{' '}
                                {opcao.entidade_nome}
                                {opcao.entidade_cliente && (
                                  <span className="text-gray-500"> • Cliente: {opcao.entidade_cliente}</span>
                                )}
                                {opcao.entidade_responsavel && (
                                  <span className="text-gray-500"> • Responsável: {opcao.entidade_responsavel}</span>
                                )}
                                {opcao.entidade_contraparte && (
                                  <span className="text-gray-500"> • {opcao.entidade_contraparte}</span>
                                )}
                                {opcao.entidade_vencimento && (
                                  <span className="text-gray-500"> • Venc: {formatDateBR(opcao.entidade_vencimento)}</span>
                                )}
                              </div>
                            </Radio>
                          ))}
                          <Radio value={null} className="w-full">
                            <span className="text-xs text-gray-500">Nenhuma das opções (pular)</span>
                          </Radio>
                        </div>
                      </Radio.Group>
                    </div>
                  </Card>
                ))}
              </div>

              {Object.values(selecoes).some((v) => v !== null) && (
                <div className="mt-4 flex justify-end">
                  <Button
                    type="primary"
                    onClick={handleConfirmarSugestoes}
                    loading={confirmandoSugestoes}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Confirmar Sugestões Selecionadas
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
