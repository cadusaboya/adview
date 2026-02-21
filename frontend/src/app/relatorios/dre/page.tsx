"use client";

import { useEffect, useState } from "react";
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyBR } from "@/lib/formatters";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import { gerarRelatorioPDF } from "@/services/pdf";
import { useUpgradeGuard } from "@/hooks/useUpgradeGuard";
import { UpgradeDialog } from "@/components/UpgradeDialog";

import { getDREConsolidado, DREData } from "@/services/relatorios";

type LineItem = {
  label: string;
  value: number;
  tipoRelatorio?: 'receita' | 'despesa';
  tipo?: string;
};

export default function DREPage() {
  const { guard, isUpgradeDialogOpen, closeUpgradeDialog, blockedFeatureLabel } = useUpgradeGuard();

  /* =========================
    FILTRO (MÊS / ANO)
    ========================= */
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  // Não precisamos mais calcular as datas aqui

  /* =========================
     STATE
  ========================= */
  const [dreData, setDREData] = useState<DREData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [loadingTipo, setLoadingTipo] = useState<string | null>(null);

  /* =========================
     FETCH DRE DATA
  ========================= */
  useEffect(() => {
    async function fetchDREData() {
      try {
        setLoading(true);
        const data = await getDREConsolidado(mes, ano);
        setDREData(data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados da DRE';
        console.error("Erro ao buscar DRE:", error);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchDREData();
  }, [mes, ano]);

  /* =========================
     PREPARAR DADOS PARA EXIBIÇÃO
  ========================= */
  const receitasLineItems: LineItem[] = dreData
    ? [
        { label: "Receitas Fixas", value: dreData.receitas.fixas, tipoRelatorio: "receita", tipo: "F" },
        { label: "Receitas Variáveis", value: dreData.receitas.variaveis, tipoRelatorio: "receita", tipo: "V" },
        { label: "Estornos", value: Math.abs(dreData.receitas.estornos), tipoRelatorio: "receita", tipo: "E" },
      ]
    : [];

  const despesasLineItems: LineItem[] = dreData
    ? [
        { label: "Despesas Fixas", value: dreData.despesas.fixas, tipoRelatorio: "despesa", tipo: "F" },
        { label: "Despesas Variáveis", value: dreData.despesas.variaveis, tipoRelatorio: "despesa", tipo: "V" },
        { label: "Comissões", value: dreData.despesas.comissoes, tipoRelatorio: "despesa", tipo: "C" },
        { label: "Reembolsos", value: dreData.despesas.reembolsos, tipoRelatorio: "despesa", tipo: "R" },
      ]
    : [];

  // 📊 Gerar relatório de DRE
  const handleGerarRelatorio = async () => {
    try {
      setLoadingRelatorio(true);
      // Para DRE, usamos as datas do filtro ou as datas atuais
      await gerarRelatorioPDF("dre-consolidado", {
        mes,
        ano,
      });
      toast.success("Relatório DRE gerado com sucesso!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar relatório';
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // 📄 Gerar relatório detalhado por tipo
  const handleGerarRelatorioTipo = async (
    tipoRelatorio: 'receita' | 'despesa',
    tipo: string,
    label: string
  ) => {
    const key = `${tipoRelatorio}-${tipo}`;
    try {
      setLoadingTipo(key);
      await gerarRelatorioPDF("dre-detalhe", {
        mes,
        ano,
        tipo_relatorio: tipoRelatorio,
        tipo,
      });
      toast.success(`Relatório de ${label} gerado com sucesso!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar relatório';
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setLoadingTipo(null);
    }
  };

  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
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
              icon={<DownloadOutlined />}
              onClick={guard('pdf_export', handleGerarRelatorio)}
              loading={loadingRelatorio}
              className="shadow-md whitespace-nowrap"
            >
              Gerar Relatório PDF
            </Button>

          </div>

          <UpgradeDialog
            open={isUpgradeDialogOpen}
            onClose={closeUpgradeDialog}
            feature={blockedFeatureLabel}
          />

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
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-sm font-medium text-muted-foreground">
                <span>Descrição</span>
                <span className="text-right">Valor</span>
                <span className="w-6" />
              </div>

              <Separator />

              {loading ? (
                <div className="text-center py-8">
                  <span className="text-sm text-muted-foreground">
                    Carregando dados da DRE...
                  </span>
                </div>
              ) : dreData ? (
                <>
                  {/* RECEITAS */}
                  <Section title="Receitas">
                    {receitasLineItems.map((item) => (
                      <Row
                        key={item.label}
                        {...item}
                        loading={loadingTipo === `${item.tipoRelatorio}-${item.tipo}`}
                        onDownload={
                          item.tipoRelatorio && item.tipo
                            ? () => handleGerarRelatorioTipo(item.tipoRelatorio!, item.tipo!, item.label)
                            : undefined
                        }
                      />
                    ))}
                    <TotalRow
                      label="Total de Receitas"
                      value={dreData.receitas.total}
                    />
                  </Section>

                  {/* DESPESAS */}
                  <Section title="Despesas">
                    {despesasLineItems.map((item) => (
                      <Row
                        key={item.label}
                        {...item}
                        loading={loadingTipo === `${item.tipoRelatorio}-${item.tipo}`}
                        onDownload={
                          item.tipoRelatorio && item.tipo
                            ? () => handleGerarRelatorioTipo(item.tipoRelatorio!, item.tipo!, item.label)
                            : undefined
                        }
                      />
                    ))}
                    <TotalRow
                      label="Total de Despesas"
                      value={dreData.despesas.total}
                    />
                  </Section>

                  {/* RESULTADO */}
                  <Section title="Resultado">
                    <TotalRow
                      label="Resultado"
                      value={dreData.resultado}
                      highlight={dreData.resultado > 0}
                      negative={dreData.resultado <= 0}
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

function Row({
  label,
  value,
  onDownload,
  loading,
}: LineItem & { onDownload?: () => void; loading?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center text-sm gap-2">
      <span>{label}</span>
      <span className={`text-right ${value < 0 ? "text-red-500" : ""}`}>
        {formatCurrencyBR(value)}
      </span>
      {onDownload ? (
        <button
          onClick={onDownload}
          disabled={loading}
          title={`Gerar relatório de ${label}`}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <FileDown className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
        </button>
      ) : (
        <span className="w-6" />
      )}
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
