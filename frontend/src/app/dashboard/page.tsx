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
  Legend,
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
  XCircle,
} from 'lucide-react';
import { getDashboardData } from "@/services/relatorios";
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';

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

const COLORS_RECEITA = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
const COLORS_DESPESA = ['#ef4444', '#f87171', '#fca5a5', '#fecaca'];

// ============================================================================
// COMPONENTS
// ============================================================================

// Card Component
const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}
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
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';
}> = ({ title, value, icon, trend, trendValue, trendLabel, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-white border-orange-400',
  };

  const iconColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    orange: 'text-orange-500',
  };

  return (
    <Card className={`${colorClasses[color]} border-2 relative`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number'
              ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : value}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
      {trend && trendValue && (
        <div className="absolute bottom-3 right-3 flex items-center">
          {trend === 'up' && (
            <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
          )}
          {trend === 'down' && (
            <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
          )}
          <span
            className={`text-[10px] font-semibold ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trendValue}
          </span>
          {trendLabel && (
            <span className="text-[10px] text-gray-500 ml-1">{trendLabel}</span>
          )}
        </div>
      )}
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'Erro ao carregar dados'}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
      <div className="bg-muted min-h-screen w-full p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-navy">Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Bem-vindo! Aqui está um resumo da sua situação financeira.
            </p>
          </div>

          {/* Financial Summary Cards - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Saldo Total"
              value={data.saldoTotal}
              icon={<DollarSign className="w-6 h-6" />}
              color="blue"
              trend={variacaoSaldo > 0 ? 'up' : variacaoSaldo < 0 ? 'down' : 'neutral'}
              trendValue={`${variacaoPercentual}%`}
              trendLabel="vs 30 dias"
            />
            <StatCard
              title="Receitas Projetadas"
              value={data.receitasProjetadas}
              icon={<TrendingUp className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Despesas Projetadas"
              value={data.despesasProjetadas}
              icon={<TrendingDown className="w-6 h-6" />}
              color="red"
            />
            <StatCard
              title="Fluxo de Caixa Realizado"
              value={data.fluxoCaixaRealizado}
              icon={<CreditCard className="w-6 h-6" />}
              color={data.fluxoCaixaRealizado > 0 ? 'green' : 'red'}
              trend={data.fluxoCaixaRealizado > 0 ? 'up' : 'down'}
            />
          </div>

          {/* Alerts Row - Despesas e Receitas Vencidas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Despesas Vencidas"
              value={data.despesasVencidas.toString()}
              icon={<AlertCircle className="w-6 h-6" />}
              color="red"
            />
            <StatCard
              title="Despesas Vencidas"
              value={data.valorDespesasVencidas}
              icon={<TrendingDown className="w-6 h-6" />}
              color="red"
            />
            <StatCard
              title="Receitas Vencidas"
              value={data.receitasVencidas.toString()}
              icon={<XCircle className="w-6 h-6" />}
              color="orange"
            />
            <StatCard
              title="Receitas Vencidas"
              value={data.valorReceitasVencidas}
              icon={<TrendingUp className="w-6 h-6" />}
              color="orange"
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

          {/* Charts Section - Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Receita vs Despesa Chart */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Receita vs Despesa (Últimos 6 Meses)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.receitaVsDespesaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) =>
                      `R$ ${(value / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      `R$ ${Number(value).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}`
                    }
                  />
                  <Legend />
                  <Bar dataKey="receita" fill="#10b981" name="Receita" />
                  <Bar dataKey="despesa" fill="#ef4444" name="Despesa" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Fluxo de Caixa Realizado */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Fluxo de Caixa Realizado (Últimos 6 Meses)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.fluxoCaixaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) =>
                      `R$ ${(value / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      `R$ ${Number(value).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}`
                    }
                  />
                  <Legend />
                  <Bar dataKey="receita" fill="#10b981" name="Entradas" />
                  <Bar dataKey="despesa" fill="#ef4444" name="Saídas" />
                  <Line
                    type="monotone"
                    dataKey="fluxo"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Fluxo Líquido"
                    yAxisId="right"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) =>
                      `R$ ${(value / 1000).toFixed(0)}k`
                    }
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
                Receita por Tipo
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
                Despesa por Tipo
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

          {/* Quick Actions - Receitas e Despesas Lado a Lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Receitas Próximas */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
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
                    new Date(receita.dataVencimento).toLocaleDateString('pt-BR'),
                ])}
              />
            </Card>

            {/* Despesas Próximas */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-red-600" />
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
                    new Date(despesa.dataVencimento).toLocaleDateString('pt-BR'),
                ])}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
