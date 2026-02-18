'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
  Cake,
  CreditCard,
  Clock,
} from 'lucide-react';
import { getDashboardData } from "@/services/relatorios";
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import { formatDateBR } from '@/lib/formatters';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  // Saldo e Fluxo
  saldoTotal: number;
  saldo30DiasAtras: number;
  fluxoCaixaRealizado: number;

  // Projeções (próximos 30 dias)
  receitasProjetadas: number;
  despesasProjetadas: number;

  // Resultado do mês atual
  resultadoMesAtual: number;

  // Alertas
  despesasVencidas: number;
  receitasVencidas: number;
  valorDespesasVencidas: number;
  valorReceitasVencidas: number;

  // Aniversariantes
  aniversariantes: {
    clientes: Array<{
      id: number;
      nome: string;
      tipo: string;
      email?: string;
      telefone?: string;
    }>;
    funcionarios: Array<{
      id: number;
      nome: string;
      tipo: string;
      email?: string;
      telefone?: string;
    }>;
  };

  // Charts Data
  receitaVsDespesaData: Array<{
    mes: string;
    receita: number;
    despesa: number;
  }>;
  fluxoCaixaData: Array<{
    mes: string;
    fluxo: number;
    receita: number;
    despesa: number;
  }>;
  receitaPorTipoData: Array<{
    name: string;
    value: number;
  }>;
  despesaPorTipoData: Array<{
    name: string;
    value: number;
  }>;

  // Quick Actions
  receitasProximas: Array<{
    id: number;
    nome: string;
    cliente: string;
    valor: number;
    dataVencimento: string;
    situacao: 'P' | 'A' | 'V';
  }>;
  despesasProximas: Array<{
    id: number;
    nome: string;
    responsavel: string;
    valor: number;
    dataVencimento: string;
    situacao: 'P' | 'A' | 'V';
  }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS_RECEITA = ['#D4AF37', '#0A192F', '#64748B', '#b8932a'];
const COLORS_DESPESA = ['#0A192F', '#64748B', '#D4AF37', '#b8932a'];

// ============================================================================
// COMPONENTS
// ============================================================================

// Card Component
const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`bg-white rounded-lg shadow-md border border-gray-200 px-6 pt-5 pb-3 ${className}`}
  >
    {children}
  </div>
);

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendLabel?: string;
  subtitle?: string;
  large?: boolean;
  color?: 'primary' | 'accent' | 'secondary' | 'warning';
}> = ({ title, value, icon, trend, trendValue, trendLabel, subtitle, large, color = 'primary' }) => {
  const colorClasses = {
    primary:   'bg-white border-navy/20',
    accent:    'bg-white border-gold/40',
    secondary: 'bg-white border-slate/30',
    warning:   'bg-white border-warning/40',
  };

  const iconColorClasses = {
    primary:   'text-navy',
    accent:    'text-gold',
    secondary: 'text-slate',
    warning:   'text-warning',
  };

  return (
    <Card className={`${colorClasses[color]} border-2`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1 whitespace-nowrap">{title}</p>
          <p className={`font-bold text-navy leading-tight whitespace-nowrap ${large ? 'text-2xl' : 'text-xl'}`}>
            {typeof value === 'number'
              ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0 ml-3 gap-1">
          <div className={`p-2 rounded-lg ${iconColorClasses[color]}`}>
            {icon}
          </div>
          {trend && trendValue && (
            <div className="flex items-center">
              {trend === 'up' && <TrendingUp className="w-3 h-3 text-slate mr-0.5" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3 text-slate mr-0.5" />}
              <span className="text-[10px] font-semibold text-slate">{trendValue}</span>
              {trendLabel && (
                <span className="text-[10px] text-gray-400 ml-0.5">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// Table Component
const Table: React.FC<{
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  className?: string;
}> = ({ headers, rows, className = '' }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          {headers.map((header, idx) => (
            <th
              key={idx}
              className="px-4 py-3 text-left font-semibold text-gray-700"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="px-4 py-6 text-center text-gray-500">
              Nenhum registro encontrado
            </td>
          </tr>
        ) : (
          rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

type ReceitaDespesaFiltro = 'ambas' | 'receitas' | 'despesas';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receitaDespesaFiltro, setReceitaDespesaFiltro] = useState<ReceitaDespesaFiltro>('ambas');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const dashboardData = await getDashboardData();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <p className="text-gray-600">{error || 'Erro ao carregar dados'}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-navy text-white rounded-lg hover:opacity-90"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Calcular variação do saldo
  const variacaoSaldo = data.saldoTotal - data.saldo30DiasAtras;
  const variacaoPercentual = data.saldo30DiasAtras !== 0 
    ? ((variacaoSaldo / Math.abs(data.saldo30DiasAtras)) * 100).toFixed(1)
    : '0';

  // Total de aniversariantes
  const totalAniversariantes = 
    data.aniversariantes.clientes.length + data.aniversariantes.funcionarios.length;

  return (
    <div className="flex">
      <NavbarNested />
      <div className="main-content-with-navbar bg-muted min-h-screen w-full px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-serif font-bold text-navy">Dashboard</h1>
          </div>

          {/* Financial Summary Cards - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="lg:col-span-2">
              <StatCard
                title="Saldo em Caixa"
                value={data.saldoTotal}
                icon={<DollarSign className="w-6 h-6" />}
                color="primary"
                trend={variacaoSaldo > 0 ? 'up' : variacaoSaldo < 0 ? 'down' : 'neutral'}
                trendValue={`${variacaoPercentual}%`}
                trendLabel="vs 30 dias"
              />
            </div>
            <StatCard
              title="Resultado (Mês Atual)"
              value={data.resultadoMesAtual}
              icon={<CreditCard className="w-6 h-6" />}
              color="primary"
              trend={data.resultadoMesAtual > 0 ? 'up' : 'down'}
            />
            <StatCard
              title="A Receber (30 dias)"
              value={data.receitasProjetadas}
              icon={<TrendingUp className="w-6 h-6" />}
              color="accent"
            />
            <StatCard
              title="A Pagar (30 dias)"
              value={data.despesasProjetadas}
              icon={<TrendingDown className="w-6 h-6" />}
              color="secondary"
            />
          </div>


          {/* Aniversariantes Details */}
          {totalAniversariantes > 0 && (
            <Card className="mb-8 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Cake className="w-5 h-5 mr-2 text-pink-600" />
                Aniversariantes de Hoje
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.aniversariantes.clientes.map((cliente) => (
                  <div
                    key={`cliente-${cliente.id}`}
                    className="p-3 bg-white rounded-lg border border-pink-200"
                  >
                    <p className="font-medium text-gray-900">{cliente.nome}</p>
                    <p className="text-xs text-gray-500 mb-1">{cliente.tipo}</p>
                    {cliente.email && (
                      <p className="text-xs text-gray-600">{cliente.email}</p>
                    )}
                    {cliente.telefone && (
                      <p className="text-xs text-gray-600">{cliente.telefone}</p>
                    )}
                  </div>
                ))}
                {data.aniversariantes.funcionarios.map((funcionario) => (
                  <div
                    key={`funcionario-${funcionario.id}`}
                    className="p-3 bg-white rounded-lg border border-pink-200"
                  >
                    <p className="font-medium text-gray-900">{funcionario.nome}</p>
                    <p className="text-xs text-gray-500 mb-1">{funcionario.tipo}</p>
                    {funcionario.email && (
                      <p className="text-xs text-gray-600">{funcionario.email}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Actions - Receitas e Despesas Lado a Lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Receitas Próximas */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-gold" />
                Receitas Próximas do Vencimento
              </h2>
              <Table
                headers={['Nome', 'Cliente', 'Valor', 'Vencimento']}
                rows={data.receitasProximas.map((receita) => [
                    receita.nome,
                    receita.cliente,
                    <span
                    key={`valor-${receita.id}`}
                    className="whitespace-nowrap font-medium"
                    >
                    R$ {receita.valor.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                    })}
                    </span>,
                    formatDateBR(receita.dataVencimento),
                ])}
              />
            </Card>

            {/* Despesas Próximas */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-slate" />
                Despesas Próximas do Vencimento
              </h2>
              <Table
                headers={['Nome', 'Responsável', 'Valor', 'Vencimento']}
                rows={data.despesasProximas.map((despesa) => [
                    despesa.nome,
                    despesa.responsavel,
                    <span
                    key={`valor-${despesa.id}`}
                    className="whitespace-nowrap font-medium"
                    >
                    R$ {despesa.valor.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                    })}
                    </span>,
                    formatDateBR(despesa.dataVencimento),
                ])}
              />
            </Card>
          </div>

          {/* Charts Section - Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Receita vs Despesa Chart */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">
                  Receita vs Despesa (Últimos 6 Meses)
                </h2>
                <select
                  value={receitaDespesaFiltro}
                  onChange={(e) => setReceitaDespesaFiltro(e.target.value as ReceitaDespesaFiltro)}
                  className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:border-navy"
                >
                  <option value="ambas">Ambas</option>
                  <option value="receitas">Só Receitas</option>
                  <option value="despesas">Só Despesas</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.receitaVsDespesaData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="#000000" strokeOpacity={0.05} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value) =>
                      `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    }
                  />
                  {receitaDespesaFiltro !== 'despesas' && (
                    <Bar dataKey="receita" fill="#D4AF37" name="Receita" radius={[3, 3, 0, 0]} />
                  )}
                  {receitaDespesaFiltro !== 'receitas' && (
                    <Bar dataKey="despesa" fill="#64748B" name="Despesa" radius={[3, 3, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Fluxo de Caixa Realizado */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                Fluxo de Caixa Realizado (Últimos 6 Meses)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.fluxoCaixaData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="#000000" strokeOpacity={0.05} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value) =>
                      `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    }
                  />
                  <Bar dataKey="receita" fill="#D4AF37" name="Entradas" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesa" fill="#64748B" name="Saídas" radius={[3, 3, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="fluxo"
                    stroke="#0A192F"
                    strokeWidth={3}
                    dot={false}
                    name="Fluxo Líquido"
                    yAxisId="right"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Charts Section - Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Receita por Tipo */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Receita por Tipo (Mês Atual)
              </h2>
              {data.receitaPorTipoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.receitaPorTipoData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent = 0 }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.receitaPorTipoData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS_RECEITA[index % COLORS_RECEITA.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        `R$ ${Number(value).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  Sem dados de receita
                </div>
              )}
            </Card>

            {/* Despesa por Tipo */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Despesa por Tipo (Mês Atual)
              </h2>
              {data.despesaPorTipoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.despesaPorTipoData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent = 0 }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.despesaPorTipoData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS_DESPESA[index % COLORS_DESPESA.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        `R$ ${Number(value).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  Sem dados de despesa
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
