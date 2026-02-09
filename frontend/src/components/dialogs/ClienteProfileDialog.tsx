"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Mail,
  Phone,
  IdCard,
  Cake,
  CreditCard,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getRelatorioCliente } from "@/services/relatorios";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { formatCurrencyBR, formatDateBR } from "@/lib/formatters";

/* ======================
   TIPOS
====================== */

interface FormaCobranca {
  id: number;
  formato: "M" | "E"; // M = Mensal | E = Êxito
  descricao?: string | null;
  valor_mensal?: number | null;
  percentual_exito?: number | null;
}

interface Client {
  id: number;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  aniversario?: string | null;
  tipo: "F" | "A";
  formas_cobranca?: FormaCobranca[];
}

interface Pending {
  id: number;
  nome: string;
  saldo: number;
  due_date: string;
}

interface Allocation {
  id: number;
  valor: number;
  observacao?: string | null;
  payment_info?: {
    id: number;
    valor: number;
    data_pagamento: string;
    conta_bancaria?: number | null;
    conta_bancaria_nome?: string | null;
  } | null;
  receita_info?: {
    id: number;
    nome: string;
    cliente?: string | null;
    valor: number;
  } | null;
  despesa_info?: {
    id: number;
    nome: string;
    responsavel?: string | null;
    valor: number;
  } | null;
  custodia_info?: {
    id: number;
    nome: string;
    tipo: string;
    tipo_display: string;
    pessoa?: string | null;
    valor_total: number;
  } | null;
}

interface Custodia {
  id: number;
  nome: string;
  descricao?: string | null;
  valor_total: number;
  valor_liquidado: number;
  saldo: number;
  status: string;
}

interface Totals {
  open: number;
  paid: number;
  custodia_pagar?: number;
}

/* ======================
   HELPERS
====================== */

function getTipoLabel(tipo: "F" | "A") {
  return tipo === "F" ? "Fixo" : "Avulso";
}

function getFormaLabel(f: FormaCobranca) {
  return f.formato === "M" ? "Mensal" : "Êxito";
}

function getFormaValor(f: FormaCobranca) {
  if (f.formato === "M") {
    return formatCurrencyBR(f.valor_mensal);
  }
  return f.percentual_exito ? `${f.percentual_exito}%` : "—";
}


/* ======================
   COMPONENT
====================== */

export function ClienteProfileDialog({
  clientId,
  open: externalOpen,
  onClose,
  children,
}: {
  clientId: number;
  open?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const [client, setClient] = useState<Client | null>(null);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [custodiasAPagar, setCustodiasAPagar] = useState<Custodia[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const data = await getRelatorioCliente(clientId);

        setClient(data.client);
        setPendings(data.pendings ?? []);
        setAllocations(data.allocations ?? []);
        setCustodiasAPagar(data.custodias_a_pagar ?? []);
        setTotals(data.totals ?? null);
      } catch {
        setError("Erro ao carregar dados financeiros do cliente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, clientId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && onClose) {
      onClose();
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}

      <DialogContent className="max-w-7xl p-0 overflow-hidden">
        <div className="flex flex-col max-h-[90vh]">
          <VisuallyHidden>
            <DialogTitle>Financeiro do Cliente</DialogTitle>
          </VisuallyHidden>

          {/* LOADING / ERROR */}
          {loading && (
            <div className="p-10 text-center text-muted-foreground">
              Carregando dados...
            </div>
          )}

          {error && !loading && (
            <div className="p-10 text-center text-destructive">{error}</div>
          )}

          {!loading && !error && client && (
            <>
            {/* HEADER */}
            <DialogHeader className="p-6 border-b bg-muted/30">
              <DialogTitle className="text-xl font-bold">
                {client.nome}
              </DialogTitle>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" /> {client.email}
                  </span>
                )}
                {client.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" /> {client.telefone}
                  </span>
                )}
                {client.cpf && (
                  <span className="flex items-center gap-1">
                    <IdCard className="w-4 h-4" /> {client.cpf}
                  </span>
                )}
                <span>
                  <strong>Tipo:</strong> {getTipoLabel(client.tipo)}
                </span>
                {client.aniversario && (
                  <span className="flex items-center gap-1">
                    <Cake className="w-4 h-4" />
                    {formatDateBR(client.aniversario)}
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* 🔹 FORMAS DE COBRANÇA */}
            {client.formas_cobranca && client.formas_cobranca.length > 0 && (
              <div className="p-6 border-b">
                <div className="flex items-center gap-2 font-semibold mb-4">
                  <CreditCard className="w-5 h-5" />
                  Formas de Cobrança
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {client.formas_cobranca.map((f) => (
                    <div
                      key={f.id}
                      className="border rounded-lg p-4 bg-muted/20"
                    >
                      <div className="text-xs uppercase text-muted-foreground">
                        {getFormaLabel(f)}
                      </div>
                      <div className="font-medium mt-1">
                        {f.descricao || "Sem descrição"}
                      </div>
                      <div className="text-sm font-semibold mt-2">
                        {getFormaValor(f)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GRID FINANCEIRO */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 divide-x flex-1 min-h-0">
              {/* Contas em Aberto */}
              <div className="flex flex-col min-h-0">
                <div className="p-4 border-b font-semibold text-destructive flex gap-2 flex-shrink-0">
                  <ArrowDownCircle className="w-5 h-5" />
                  Contas em Aberto
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-right">Vencimento</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendings.map((p) => (
                        <tr key={p.id} className="border-b">
                          <td className="px-4 py-2">{p.nome}</td>
                          <td className="px-4 py-2 text-right">
                            {formatDateBR(p.due_date)}
                          </td>
                          <td className="px-4 py-2 text-right text-destructive">
                            {formatCurrencyBR(p.saldo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>

                {totals && (
                  <div className="p-4 border-t text-right font-semibold text-destructive flex-shrink-0">
                    Total em aberto: {formatCurrencyBR(totals.open)}
                  </div>
                )}
              </div>

              {/* Custódias a Pagar */}
              <div className="flex flex-col min-h-0">
                <div className="p-4 border-b font-semibold text-orange-600 flex gap-2 flex-shrink-0">
                  <ArrowDownCircle className="w-5 h-5" />
                  Custódias a Pagar
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-right">Vencimento</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custodiasAPagar.map((c) => (
                        <tr key={c.id} className="border-b">
                          <td className="px-4 py-2">{c.nome}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            -
                          </td>
                          <td className="px-4 py-2 text-right text-orange-600">
                            {formatCurrencyBR(c.saldo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>

                {totals && (
                  <div className="p-4 border-t text-right font-semibold text-orange-600 flex-shrink-0">
                    Total a pagar: {formatCurrencyBR(totals.custodia_pagar || 0)}
                  </div>
                )}
              </div>

              {/* Pagamentos */}
              <div className="flex flex-col min-h-0">
                <div className="p-4 border-b font-semibold text-emerald-600 flex gap-2 flex-shrink-0">
                  <ArrowUpCircle className="w-5 h-5" />
                  Pagamentos Realizados
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Descrição</th>
                        <th className="px-4 py-2 text-right">Pagamento</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((alloc) => {
                        const isCustodia = !!alloc.custodia_info;
                        const descricao = alloc.receita_info?.nome ||
                                         alloc.despesa_info?.nome ||
                                         alloc.custodia_info?.nome ||
                                         "Pagamento";

                        return (
                          <tr key={alloc.id} className="border-b">
                            <td className="px-4 py-2">
                              {descricao}
                              {isCustodia && (
                                <span className="ml-2 text-xs text-orange-600 font-medium">
                                  (Custódia)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {alloc.payment_info?.data_pagamento && formatDateBR(alloc.payment_info.data_pagamento)}
                            </td>
                            <td className="px-4 py-2 text-right text-emerald-600">
                              {formatCurrencyBR(alloc.valor)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>

                {totals && (
                  <div className="p-4 border-t text-right font-semibold text-emerald-600 flex-shrink-0">
                    Total pago: {formatCurrencyBR(totals.paid)}
                  </div>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
