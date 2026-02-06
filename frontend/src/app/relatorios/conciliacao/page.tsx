"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBR } from "@/lib/formatters";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import {
  getRelatorioConciliacaoBancaria,
  ConciliacaoBancariaRelatorioData,
} from "@/services/relatorios";
import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  Building2,
  FileCheck,
  FileX,
  Link,
} from "lucide-react";
import VincularLancamentoDialog from "@/components/dialogs/VincularLancamentoDialog";
import { Button } from "@/components/ui/button";

export default function RelatorioConciliacaoBancariaPage() {
  /* ========================= FILTRO (MÊS / ANO) ========================= */
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  /* ========================= STATE ========================= */
  const [relatorioData, setRelatorioData] =
    useState<ConciliacaoBancariaRelatorioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLancamento, setSelectedLancamento] =
    useState<ConciliacaoBancariaRelatorioData["lancamentos_pendentes"][0] | null>(null);
  const [openVincularDialog, setOpenVincularDialog] = useState(false);

  /* ========================= FETCH RELATÓRIO DATA ========================= */
  useEffect(() => {
    async function fetchRelatorioData() {
      try {
        setLoading(true);
        const data = await getRelatorioConciliacaoBancaria(mes, ano);
        setRelatorioData(data);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Erro ao carregar relatório de conciliação bancária";
        console.error("Erro ao buscar relatório:", error);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchRelatorioData();
  }, [mes, ano]);

  /* ========================= HELPER FUNCTIONS ========================= */
  const getStatusBadgeColor = (cor: string) => {
    switch (cor) {
      case "success":
        return "bg-green-100 text-green-800 border-green-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "error":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const handleOpenVincularDialog = (
    lancamento: ConciliacaoBancariaRelatorioData["lancamentos_pendentes"][0]
  ) => {
    setSelectedLancamento(lancamento);
    setOpenVincularDialog(true);
  };

  const handleVincularSuccess = async () => {
    // Recarregar o relatório após vincular
    try {
      const data = await getRelatorioConciliacaoBancaria(mes, ano);
      setRelatorioData(data);
      toast.success("Relatório atualizado");
    } catch (error) {
      console.error("Erro ao recarregar relatório:", error);
    }
  };

  return (
    <div className="flex">
      <NavbarNested />

      <main className="bg-muted min-h-screen w-full p-6">
        <div className="space-y-6">
          {/* HEADER */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <FileCheck className="h-6 w-6" />
                Relatório de Conciliação Bancária
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Visualize o status completo da conciliação do período selecionado
              </p>
            </div>
          </div>

          {/* FILTROS */}
          <div className="flex gap-4 items-end">
            {/* MÊS */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Mês</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm bg-white"
              >
                {[
                  "Janeiro",
                  "Fevereiro",
                  "Março",
                  "Abril",
                  "Maio",
                  "Junho",
                  "Julho",
                  "Agosto",
                  "Setembro",
                  "Outubro",
                  "Novembro",
                  "Dezembro",
                ].map((nome, index) => (
                  <option key={index} value={index + 1}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>

            {/* ANO */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Ano</label>
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm bg-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <span className="text-sm text-muted-foreground">
                Carregando relatório de conciliação...
              </span>
            </div>
          ) : relatorioData ? (
            <>
              {/* CARDS DE RESUMO */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* STATUS GERAL */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Status Geral
                    </CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge
                        className={getStatusBadgeColor(
                          relatorioData.resumo.status_cor
                        )}
                      >
                        {relatorioData.resumo.status_geral}
                      </Badge>
                      <p className="text-2xl font-bold">
                        {relatorioData.resumo.percentual_conciliado.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        de conciliação completa
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* LANÇAMENTOS */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Lançamentos
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">
                        {relatorioData.resumo.total_lancamentos}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {relatorioData.resumo.total_conciliados} conciliados
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3 w-3" />
                          {relatorioData.resumo.total_nao_conciliados} pendentes
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ENTRADAS */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Entradas
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrencyBR(relatorioData.valores.total_entradas)}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          Conciliadas:{" "}
                          {formatCurrencyBR(
                            relatorioData.valores.entradas_conciliadas
                          )}
                        </div>
                        <div>
                          Pendentes:{" "}
                          {formatCurrencyBR(
                            relatorioData.valores.entradas_pendentes
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SAÍDAS */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saídas</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrencyBR(relatorioData.valores.total_saidas)}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          Conciliadas:{" "}
                          {formatCurrencyBR(
                            relatorioData.valores.saidas_conciliadas
                          )}
                        </div>
                        <div>
                          Pendentes:{" "}
                          {formatCurrencyBR(
                            relatorioData.valores.saidas_pendentes
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SALDO DO PERÍODO */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Saldo do Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Período: {relatorioData.periodo.data_inicio} a{" "}
                        {relatorioData.periodo.data_fim}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-3xl font-bold ${
                          relatorioData.valores.saldo_periodo >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrencyBR(relatorioData.valores.saldo_periodo)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VINCULAÇÕES */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo de Vinculações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Receitas</p>
                      <p className="text-lg font-semibold">
                        {relatorioData.vinculacoes.receitas.quantidade}
                      </p>
                      <p className="text-sm text-green-600">
                        {formatCurrencyBR(
                          relatorioData.vinculacoes.receitas.valor_total
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Despesas</p>
                      <p className="text-lg font-semibold">
                        {relatorioData.vinculacoes.despesas.quantidade}
                      </p>
                      <p className="text-sm text-red-600">
                        {formatCurrencyBR(
                          relatorioData.vinculacoes.despesas.valor_total
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Custódias</p>
                      <p className="text-lg font-semibold">
                        {relatorioData.vinculacoes.custodias.quantidade}
                      </p>
                      <p className="text-sm text-blue-600">
                        {formatCurrencyBR(
                          relatorioData.vinculacoes.custodias.valor_total
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* RESUMO POR CONTA BANCÁRIA */}
              {relatorioData.por_conta.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Resumo por Conta Bancária
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-sm text-muted-foreground border-b">
                            <th className="text-left py-2">Conta</th>
                            <th className="text-center py-2">Total</th>
                            <th className="text-center py-2">Conciliados</th>
                            <th className="text-center py-2">Pendentes</th>
                            <th className="text-right py-2">Entradas</th>
                            <th className="text-right py-2">Saídas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorioData.por_conta.map((conta) => (
                            <tr key={conta.id} className="border-b text-sm">
                              <td className="py-3 font-medium">{conta.nome}</td>
                              <td className="text-center">
                                {conta.total_lancamentos}
                              </td>
                              <td className="text-center text-green-600">
                                {conta.conciliados}
                              </td>
                              <td className="text-center text-red-600">
                                {conta.pendentes}
                              </td>
                              <td className="text-right text-green-600">
                                {formatCurrencyBR(conta.entradas)}
                              </td>
                              <td className="text-right text-red-600">
                                {formatCurrencyBR(conta.saidas)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* LANÇAMENTOS PENDENTES */}
              {relatorioData.lancamentos_pendentes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileX className="h-5 w-5 text-red-600" />
                      Lançamentos Pendentes de Conciliação
                      <Badge variant="destructive">
                        {relatorioData.total_pendentes}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-sm text-muted-foreground border-b">
                            <th className="text-left py-2">Data</th>
                            <th className="text-left py-2">Tipo</th>
                            <th className="text-left py-2">Conta</th>
                            <th className="text-right py-2 pr-8">Valor Não Vinculado</th>
                            <th className="text-left py-2">Observação</th>
                            <th className="text-center py-2">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorioData.lancamentos_pendentes.map(
                            (lancamento) => (
                              <tr key={lancamento.id} className="border-b text-sm">
                                <td className="py-3">{lancamento.data}</td>
                                <td>
                                  <Badge
                                    variant={
                                      lancamento.tipo === "Entrada"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={
                                      lancamento.tipo === "Entrada"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }
                                  >
                                    {lancamento.tipo}
                                  </Badge>
                                </td>
                                <td className="text-muted-foreground">
                                  {lancamento.conta_bancaria}
                                </td>
                                <td className="text-right font-medium pr-8 text-foreground">
                                  {formatCurrencyBR(
                                    lancamento.valor_nao_vinculado ??
                                    (lancamento.valor - (lancamento.valor_alocado || 0))
                                  )}
                                </td>
                                <td className="text-muted-foreground text-xs max-w-xs truncate">
                                  {lancamento.observacao || "-"}
                                </td>
                                <td className="text-center py-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenVincularDialog(lancamento)}
                                    className="flex items-center gap-1"
                                  >
                                    <Link className="h-3 w-3" />
                                    Vincular
                                  </Button>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                    {relatorioData.total_pendentes >
                      relatorioData.total_pendentes_exibidos && (
                      <p className="text-sm text-muted-foreground mt-4 text-center">
                        Exibindo {relatorioData.total_pendentes_exibidos} de{" "}
                        {relatorioData.total_pendentes} lançamentos pendentes
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* LANÇAMENTOS CONCILIADOS RECENTES */}
              {relatorioData.lancamentos_conciliados_recentes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-green-600" />
                      Últimos Lançamentos Conciliados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {relatorioData.lancamentos_conciliados_recentes.map(
                        (lancamento) => (
                          <div
                            key={lancamento.id}
                            className="border rounded-lg p-4 space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      lancamento.tipo === "Entrada"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={
                                      lancamento.tipo === "Entrada"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }
                                  >
                                    {lancamento.tipo}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {lancamento.data}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {lancamento.conta_bancaria}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {lancamento.observacao || "-"}
                                </p>
                              </div>
                              <p
                                className={`text-lg font-semibold ${
                                  lancamento.tipo === "Entrada"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatCurrencyBR(lancamento.valor)}
                              </p>
                            </div>
                            {lancamento.vinculos.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Vinculado a:
                                </p>
                                <div className="space-y-1">
                                  {lancamento.vinculos.map((vinculo, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between text-sm bg-muted p-2 rounded"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {vinculo.tipo}
                                        </Badge>
                                        <span>{vinculo.descricao}</span>
                                      </div>
                                      <span className="font-medium">
                                        {formatCurrencyBR(vinculo.valor)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* MENSAGEM DE SUCESSO SE TUDO CONCILIADO */}
              {relatorioData.resumo.total_nao_conciliados === 0 &&
                relatorioData.resumo.total_lancamentos > 0 && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center gap-3 text-green-800">
                        <CheckCircle2 className="h-8 w-8" />
                        <div>
                          <h3 className="text-lg font-semibold">
                            Conciliação Completa!
                          </h3>
                          <p className="text-sm">
                            Todos os lançamentos do período foram conciliados com
                            sucesso.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
            </>
          ) : (
            <div className="text-center py-12">
              <span className="text-sm text-red-500">
                Erro ao carregar dados do relatório
              </span>
            </div>
          )}
        </div>

        {/* Dialog para vincular lançamento */}
        <VincularLancamentoDialog
          open={openVincularDialog}
          onClose={() => {
            setOpenVincularDialog(false);
            setSelectedLancamento(null);
          }}
          lancamento={selectedLancamento}
          onSuccess={handleVincularSuccess}
        />
      </main>
    </div>
  );
}
