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
} from "lucide-react";
import { useEffect, useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { formatCurrencyBR, formatDateBR } from "@/lib/formatters";
import { getRelatorioFuncionario } from "@/services/relatorios";

/* ======================
   TIPOS
====================== */

interface Funcionario {
  id: number;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
}

interface Pending {
  id: number;
  nome: string;
  saldo: number;
  due_date: string;
}

interface Payment {
  id: number;
  valor: number;
  data_pagamento: string;
  observacao?: string | null;
  receita_nome?: string;
  despesa_nome?: string;
}

interface Totals {
  open: number;
  paid: number;
}

/* ======================
   COMPONENT
====================== */

export function FuncionarioProfileDialog({
  funcionarioId,
  children,
}: {
  funcionarioId: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const data = await getRelatorioFuncionario(funcionarioId);

        setFuncionario(data.funcionario);
        setPendings(data.pendings ?? []);
        setPayments(data.payments ?? []);
        setTotals(data.totals ?? null);
      } catch {
        setError("Erro ao carregar dados financeiros do funcionário.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, funcionarioId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="flex flex-col max-h-[85vh]">
          {/* Acessibilidade */}
          <VisuallyHidden>
            <DialogTitle>Financeiro do Funcionário</DialogTitle>
          </VisuallyHidden>

          {/* LOADING */}
          {loading && (
            <div className="p-10 text-center text-muted-foreground">
              Carregando dados...
            </div>
          )}

          {/* ERROR */}
          {error && !loading && (
            <div className="p-10 text-center text-destructive">
              {error}
            </div>
          )}

          {/* CONTEÚDO */}
          {!loading && !error && funcionario && (
            <>
            {/* HEADER */}
            <DialogHeader className="p-6 border-b bg-muted/30">
              <DialogTitle className="text-xl font-bold">
                {funcionario.nome}
              </DialogTitle>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {funcionario.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {funcionario.email}
                  </span>
                )}

                {funcionario.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {funcionario.telefone}
                  </span>
                )}

                {funcionario.cpf && (
                  <span className="flex items-center gap-1">
                    <IdCard className="w-4 h-4" />
                    {funcionario.cpf}
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* GRID FINANCEIRO */}
            <div className="grid md:grid-cols-2 divide-x flex-1 min-h-0">
              {/* 🔻 CONTAS A PAGAR */}
              <div className="flex flex-col min-h-0">
                <div className="p-4 border-b font-semibold text-destructive flex gap-2 flex-shrink-0">
                  <ArrowDownCircle className="w-5 h-5" />
                  Contas a Pagar
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
                    Total a pagar: {formatCurrencyBR(totals.open)}
                  </div>
                )}
              </div>

              {/* 🔺 PAGAMENTOS */}
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
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b">
                          <td className="px-4 py-2">
                            {p.receita_nome || p.despesa_nome || "Pagamento"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatDateBR(p.data_pagamento)}
                          </td>
                          <td className="px-4 py-2 text-right text-emerald-600">
                            {formatCurrencyBR(p.valor)}
                          </td>
                        </tr>
                      ))}
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
