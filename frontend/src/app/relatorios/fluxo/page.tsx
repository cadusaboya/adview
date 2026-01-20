"use client";

import { useEffect, useState } from "react";
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import RelatorioFiltrosModal from "@/components/dialogs/RelatorioFiltrosModal";
import { gerarRelatorioPDF } from "@/services/pdf";
import { RelatorioFiltros } from "@/components/dialogs/RelatorioFiltrosModal";
import { formatCurrencyBR } from "@/lib/formatters";

import { getPayments, Payment } from "@/services/payments";
import { getBancos, Banco } from "@/services/bancos";

/* =========================
   HELPERS
========================= */

function parseMoney(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value.replace(/\s/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = parseISODate(start);
  const last = parseISODate(end);

  while (current <= last) {
    dates.push(toISODate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/* =========================
   TYPES
========================= */

type DayRow = {
  type: "day";
  date: string;
  entradas: number;
  saidas: number;
  saldo: number;
  payments: Payment[];
};

type Row =
  | { type: "saldo-inicial"; saldo: number }
  | DayRow
  | { type: "saldo-final"; saldo: number };

/* =========================
   PAGE
========================= */

export default function FluxoCaixaPage() {
  const today = new Date();
  const startDefault = new Date();
  startDefault.setDate(today.getDate() - 6);

  const [startDate, setStartDate] = useState(toISODate(startDefault));
  const [endDate, setEndDate] = useState(toISODate(today));
  const [rows, setRows] = useState<Row[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [contas, setContas] = useState<Banco[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  useEffect(() => {
    loadContas();
  }, []);

  const loadContas = async () => {
    try {
      const res = await getBancos({ page_size: 1000 });
      setContas(res.results);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    }
  };

  useEffect(() => {
    async function buildFlow() {
      setLoading(true);

      /* SALDO ATUAL */
      const bancosRes = await getBancos({ page_size: 1000 });
      const saldoHoje = bancosRes.results.reduce(
        (acc: number, b: Banco) => acc + parseMoney(b.saldo_atual),
        0
      );

      /* PAGAMENTOS FUTUROS */
      const dayAfterEnd = parseISODate(endDate);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);

      const futurePayments = await getPayments({
        start_date: toISODate(dayAfterEnd),
        page_size: 1000,
      });

      let impactoFuturo = 0;
      futurePayments.results.forEach((p) => {
        const valor = parseMoney(p.valor);
        if (p.receita) impactoFuturo += valor;
        else impactoFuturo -= valor;
      });

      const saldoFinalPeriodo = saldoHoje - impactoFuturo;

      /* PAGAMENTOS DO PERÍODO */
      const periodPayments = await getPayments({
        start_date: startDate,
        end_date: endDate,
        page_size: 1000,
      });

      const byDate: Record<string, Payment[]> = {};
      let totalEntradas = 0;
      let totalSaidas = 0;

      periodPayments.results.forEach((p) => {
        const date = p.data_pagamento;
        const valor = parseMoney(p.valor);

        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(p);

        if (p.receita) totalEntradas += valor;
        else totalSaidas += valor;
      });

      const saldoInicialPeriodo =
        saldoFinalPeriodo + totalSaidas - totalEntradas;

      /* CONSTRUIR LINHAS */
      const dates = getDateRange(startDate, endDate);
      let saldoCorrente = saldoInicialPeriodo;

      const dailyRows: DayRow[] = [];

      dates.forEach((date) => {
        const payments = byDate[date] || [];
        let entradas = 0;
        let saidas = 0;

        payments.forEach((p) => {
          const valor = parseMoney(p.valor);
          if (p.receita) entradas += valor;
          else saidas += valor;
        });

        saldoCorrente = saldoCorrente + entradas - saidas;

        dailyRows.push({
          type: "day",
          date,
          entradas,
          saidas,
          saldo: saldoCorrente,
          payments,
        });
      });

      setRows([
        { type: "saldo-inicial", saldo: saldoInicialPeriodo },
        ...dailyRows,
        { type: "saldo-final", saldo: saldoFinalPeriodo },
      ]);

      setExpandedDate(null);
      setLoading(false);
    }

    buildFlow();
  }, [startDate, endDate]);

  // 📊 Gerar relatório de fluxo de caixa
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF("fluxo-de-caixa", {
        conta_bancaria_id: filtros.conta_bancaria_id,
        data_inicio: filtros.data_inicio || startDate,
        data_fim: filtros.data_fim || endDate,
      });
      toast.success("Relatório de Fluxo de Caixa gerado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar relatório");
    } finally {
      setLoadingRelatorio(false);
    }
  };

  return (
    <div className="flex">
      <NavbarNested />

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Fluxo de Caixa Realizado</h1>

          {/* 📊 BOTÃO PARA GERAR RELATÓRIO */}
          <Button
            icon={<DownloadOutlined />}
            onClick={() => setOpenRelatorioModal(true)}
            loading={loadingRelatorio}
            className="shadow-md whitespace-nowrap"
          >
            Gerar Relatório PDF
          </Button>
        </div>

        {/* FILTRO */}
        <div className="flex gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="grid grid-cols-4 text-sm font-medium text-muted-foreground">
              <span>Data</span>
              <span className="text-right">Entradas</span>
              <span className="text-right">Saídas</span>
              <span className="text-right">Saldo</span>
            </div>

            <Separator />

            {loading ? (
              <span>Carregando...</span>
            ) : (
              rows.map((row, idx) => {
                if (row.type !== "day") {
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-4 font-semibold py-1"
                    >
                      <span>
                        {row.type === "saldo-inicial"
                          ? "Saldo Inicial"
                          : "Saldo Final"}
                      </span>
                      <span />
                      <span />
                      <span className="text-right">
                        {formatCurrencyBR(row.saldo)}
                      </span>
                    </div>
                  );
                }

                const isOpen = expandedDate === row.date;
                const zebra =
                  idx % 2 === 0 ? "bg-white" : "bg-muted/30";

                return (
                  <div key={row.date}>
                    {/* LINHA DO DIA */}
                    <div
                      className={`grid grid-cols-4 text-sm py-1 cursor-pointer rounded items-center hover:bg-muted/40 ${zebra}`}
                      onClick={() =>
                        setExpandedDate(isOpen ? null : row.date)
                      }
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {isOpen ? "▼" : "▶"}
                        </span>
                        {parseISODate(row.date).toLocaleDateString("pt-BR")}
                      </span>

                      <span className="text-right text-green-600">
                        {formatCurrencyBR(row.entradas)}
                      </span>
                      <span className="text-right text-red-600">
                        {formatCurrencyBR(row.saidas)}
                      </span>
                      <span className="text-right font-semibold">
                        {formatCurrencyBR(row.saldo)}
                      </span>
                    </div>

                    {/* DETALHE COM ZEBRA */}
                    {isOpen && (
                      <div className="ml-6 mt-2 space-y-1 text-sm">
                        {row.payments.length === 0 ? (
                          <span className="text-muted-foreground">
                            Nenhuma movimentação neste dia.
                          </span>
                        ) : (
                          row.payments.map((p, pIdx) => {
                            const zebraPayment =
                              pIdx % 2 === 0
                                ? "bg-white"
                                : "bg-muted/20";

                            return (
                              <div
                                key={p.id}
                                className={`flex justify-between px-2 py-1 rounded ${zebraPayment}`}
                              >
                                <span>
                                  {p.receita
                                    ? p.receita_nome || "Receita"
                                    : p.despesa_nome || "Despesa"}
                                </span>
                                <span
                                  className={
                                    p.receita
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {formatCurrencyBR(parseMoney(p.valor))}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 📊 MODAL DE FILTROS DO RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Fluxo de Caixa"
          tipoRelatorio="fluxo-de-caixa"
          contas={contas.map((c) => ({
            id: c.id,
            nome: c.nome,
          }))}
        />
      </main>
    </div>
  );
}
