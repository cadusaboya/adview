"use client";

import { useEffect, useState } from "react";
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyBR } from "@/lib/formatters";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import RelatorioFiltrosModal from "@/components/dialogs/RelatorioFiltrosModal";
import { gerarRelatorioPDF } from "@/services/pdf";
import { RelatorioFiltros } from "@/components/dialogs/RelatorioFiltrosModal";

import { getDespesas, Despesa } from "@/services/despesas";
import { getReceitas, Receita } from "@/services/receitas";

type LineItem = {
  label: string;
  value: number;
};

export default function DREPage() {
  /* =========================
    FILTRO (MÊS / ANO)
    ========================= */
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const endDate = new Date(ano, mes, 0).toISOString().split("T")[0];

  /* =========================
     STATE
  ========================= */
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  /* =========================
     FETCH DESPESAS + RECEITAS
  ========================= */
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const [despesasRes, receitasRes] = await Promise.all([
        getDespesas({
          start_date: startDate,
          end_date: endDate,
          page_size: 1000,
        }),
        getReceitas({
          start_date: startDate,
          end_date: endDate,
          page_size: 1000,
        }),
      ]);

      setDespesas(despesasRes.results);
      setReceitas(receitasRes.results);
      setLoading(false);
    }

    fetchData();
  }, [startDate, endDate]);

  /* =========================
     DESPESAS – AGRUPAMENTO
  ========================= */
  const despesasFixas = despesas
    .filter((d) => d.tipo === "F")
    .reduce((acc, d) => acc + Number(d.valor), 0);

  const despesasVariaveis = despesas
    .filter((d) => d.tipo === "V")
    .reduce((acc, d) => acc + Number(d.valor), 0);

  const comissoes = despesas
    .filter((d) => d.tipo === "C")
    .reduce((acc, d) => acc + Number(d.valor), 0);

  /* =========================
     RECEITAS – AGRUPAMENTO
  ========================= */
  const receitasFixas = receitas
    .filter((r: any) => r.tipo === "F")
    .reduce((acc, r) => acc + Number(r.valor), 0);

  const receitasVariaveis = receitas
    .filter((r: any) => r.tipo === "V")
    .reduce((acc, r) => acc + Number(r.valor), 0);

  const estornos = receitas
    .filter((r: any) => r.tipo === "E")
    .reduce((acc, r) => acc + Number(r.valor), 0);

  const receitasLineItems: LineItem[] = [
    { label: "Receitas Fixas", value: receitasFixas },
    { label: "Receitas Variáveis", value: receitasVariaveis },
    { label: "Estornos", value: Math.abs(estornos) },
  ];

  const totalReceitas = receitasLineItems.reduce(
    (acc, i) => acc + i.value,
    0
  );

  const despesasLineItems: LineItem[] = [
    { label: "Despesas Fixas", value: despesasFixas },
    { label: "Despesas Variáveis", value: despesasVariaveis },
    { label: "Comissões", value: comissoes },
  ];

  const totalDespesas = despesasLineItems.reduce(
    (acc, i) => acc + i.value,
    0
  );

  const resultado = totalReceitas - totalDespesas;

  // 📊 Gerar relatório de DRE
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      // Para DRE, usamos as datas do filtro ou as datas atuais
      await gerarRelatorioPDF("dre-consolidado", {
        data_inicio: filtros.data_inicio || startDate,
        data_fim: filtros.data_fim || endDate,
      });
      toast.success("Relatório DRE gerado com sucesso!");
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

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold">
                Demonstração do Resultado (DRE)
              </h1>
              <p className="text-sm text-muted-foreground">
                {String(mes).padStart(2, "0")}/{ano}
              </p>
            </div>

            {/* 📊 BOTÃO PARA GERAR RELATÓRIO */}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => setOpenRelatorioModal(true)}
              loading={loadingRelatorio}
            >
              Gerar Relatório PDF
            </Button>
          </div>

          <div className="flex gap-4 items-end">
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
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 text-sm font-medium text-muted-foreground">
                <span>Descrição</span>
                <span className="text-right">Valor</span>
              </div>

              <Separator />

              {/* RECEITAS */}
              <Section title="Receitas">
                {receitasLineItems.map((item) => (
                  <Row key={item.label} {...item} />
                ))}
                <TotalRow label="Total de Receitas" value={totalReceitas} />
              </Section>

              {/* DESPESAS */}
              <Section title="Despesas">
                {loading ? (
                  <span className="text-sm text-muted-foreground">
                    Carregando dados...
                  </span>
                ) : (
                  <>
                    {despesasLineItems.map((item) => (
                      <Row key={item.label} {...item} />
                    ))}
                    <TotalRow
                      label="Total de Despesas"
                      value={totalDespesas}
                    />
                  </>
                )}
              </Section>

              {/* RESULTADO */}
              <Section title="Resultado">
                <TotalRow
                  label="Resultado"
                  value={resultado}
                  highlight={resultado > 0}
                  negative={resultado <= 0}
                />
              </Section>
            </CardContent>
          </Card>
        </div>

        {/* 📊 MODAL DE FILTROS DO RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de DRE Consolidado"
          tipoRelatorio="dre-consolidado"
        />
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
