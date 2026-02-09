"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyBR } from "@/lib/formatters";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";

import { getBalancoPatrimonial, BalancoData } from "@/services/relatorios";

type LineItem = {
  label: string;
  value: number;
};

type AgrupamentoTipo = 'banco' | 'tipo';

export default function BalancoPage() {
  /* =========================
    FILTRO (MÊS / ANO)
    ========================= */
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  /* =========================
     STATE
  ========================= */
  const [balancoData, setBalancoData] = useState<BalancoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agrupamento, setAgrupamento] = useState<AgrupamentoTipo>('banco');
  const [incluirCustodias, setIncluirCustodias] = useState(true);

  /* =========================
     FETCH BALANÇO DATA
  ========================= */
  useEffect(() => {
    async function fetchBalancoData() {
      try {
        setLoading(true);
        const data = await getBalancoPatrimonial(mes, ano);
        setBalancoData(data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados do Fluxo de Caixa';
        console.error("Erro ao buscar Fluxo de Caixa:", error);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchBalancoData();
  }, [mes, ano]);

  /* =========================
     PREPARAR DADOS PARA EXIBIÇÃO
  ========================= */
  const entradasLineItems: LineItem[] = balancoData
    ? agrupamento === 'banco'
      ? balancoData.entradas.por_banco.map(item => ({
          label: item.banco,
          value: item.valor
        }))
      : balancoData.entradas.por_tipo
          .filter(item => incluirCustodias || item.tipo !== 'Valores Reembolsados')
          .map(item => ({
            label: item.tipo,
            value: item.valor
          }))
    : [];

  const saidasLineItems: LineItem[] = balancoData
    ? agrupamento === 'banco'
      ? balancoData.saidas.por_banco.map(item => ({
          label: item.banco,
          value: item.valor
        }))
      : balancoData.saidas.por_tipo
          .filter(item => incluirCustodias || item.tipo !== 'Valores Reembolsáveis')
          .map(item => ({
            label: item.tipo,
            value: item.valor
          }))
    : [];

  /* =========================
     CALCULAR TOTAIS AJUSTADOS (sem custódias se filtrado)
  ========================= */
  const totalEntradasAjustado = balancoData
    ? agrupamento === 'tipo' && !incluirCustodias
      ? balancoData.entradas.total -
        (balancoData.entradas.por_tipo.find(item => item.tipo === 'Valores Reembolsados')?.valor || 0)
      : balancoData.entradas.total
    : 0;

  const totalSaidasAjustado = balancoData
    ? agrupamento === 'tipo' && !incluirCustodias
      ? balancoData.saidas.total -
        (balancoData.saidas.por_tipo.find(item => item.tipo === 'Valores Reembolsáveis')?.valor || 0)
      : balancoData.saidas.total
    : 0;

  const resultadoAjustado = totalEntradasAjustado - totalSaidasAjustado;

  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold">
                Fluxo de Caixa Realizado
              </h1>
              <p className="text-sm text-muted-foreground">
                Movimentações em {String(mes).padStart(2, "0")}/{ano}
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-end flex-wrap">
            {/* MÊS */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Mês</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm"
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
                className="border rounded-md px-3 py-2 text-sm"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* AGRUPAMENTO */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Agrupar por</label>
              <select
                value={agrupamento}
                onChange={(e) => setAgrupamento(e.target.value as AgrupamentoTipo)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="banco">Banco</option>
                <option value="tipo">Tipo</option>
              </select>
            </div>

            {/* INCLUIR CUSTÓDIAS - Apenas visível quando agrupar por tipo */}
            {agrupamento === 'tipo' && (
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="incluirCustodias"
                  checked={incluirCustodias}
                  onChange={(e) => setIncluirCustodias(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="incluirCustodias" className="text-sm cursor-pointer">
                  Incluir Custódias
                </label>
              </div>
            )}
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 text-sm font-medium text-muted-foreground">
                <span>Descrição</span>
                <span className="text-right">Valor</span>
              </div>

              <Separator />

              {loading ? (
                <div className="text-center py-8">
                  <span className="text-sm text-muted-foreground">
                    Carregando dados do Fluxo de Caixa...
                  </span>
                </div>
              ) : balancoData ? (
                <>
                  {/* ENTRADAS */}
                  <Section title="Entradas (Recebimentos)">
                    {entradasLineItems.length > 0 ? (
                      <>
                        {entradasLineItems.map((item) => (
                          <Row key={item.label} {...item} />
                        ))}
                        <TotalRow
                          label="Total de Entradas"
                          value={totalEntradasAjustado}
                          highlight={true}
                        />
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground py-2">
                        Nenhuma entrada registrada neste período
                      </div>
                    )}
                  </Section>

                  {/* SAÍDAS */}
                  <Section title="Saídas (Pagamentos)">
                    {saidasLineItems.length > 0 ? (
                      <>
                        {saidasLineItems.map((item) => (
                          <Row key={item.label} {...item} />
                        ))}
                        <TotalRow
                          label="Total de Saídas"
                          value={totalSaidasAjustado}
                        />
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground py-2">
                        Nenhuma saída registrada neste período
                      </div>
                    )}
                  </Section>

                  {/* RESULTADO */}
                  <Section title="Resultado do Período">
                    <TotalRow
                      label="Saldo do Período"
                      value={resultadoAjustado}
                      highlight={resultadoAjustado > 0}
                      negative={resultadoAjustado < 0}
                    />
                  </Section>
                </>
              ) : (
                <div className="text-center py-8">
                  <span className="text-sm text-red-500">
                    Erro ao carregar dados
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

/* =========================
   HELPERS
========================= */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        {title}
      </h2>
      {children}
      <Separator />
    </div>
  );
}

function Row({ label, value }: LineItem) {
  return (
    <div className="grid grid-cols-2 text-sm">
      <span>{label}</span>
      <span
        className={`text-right ${value < 0 ? "text-red-500" : ""}`}
      >
        {formatCurrencyBR(value)}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  highlight = false,
  negative = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 font-semibold ${
        highlight ? "text-green-600" : negative ? "text-red-600" : ""
      }`}
    >
      <span>{label}</span>
      <span className="text-right">{formatCurrencyBR(value)}</span>
    </div>
  );
}
