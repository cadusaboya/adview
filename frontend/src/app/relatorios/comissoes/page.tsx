'use client';

import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { getFuncionarios } from '@/services/funcionarios';
import { gerarRelatorioPDF } from '@/services/pdf';
import { getErrorMessage } from '@/lib/errors';

export default function ComissoesPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [funcionarioId, setFuncionarioId] = useState<string>('todos');
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFuncionarios();
  }, []);

  const loadFuncionarios = async () => {
    try {
      const response = await getFuncionarios({ page: 1, page_size: 1000 });
      // Filtrar apenas Funcionários (F) e Parceiros (P)
      const filtered = response.results.filter(
        (f: any) => f.tipo === 'F' || f.tipo === 'P'
      );
      setFuncionarios(filtered);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const handleGerarPDF = async () => {
    try {
      setLoading(true);

      const payload: any = {
        mes,
        ano,
      };

      if (funcionarioId !== 'todos') {
        payload.funcionario_id = Number(funcionarioId);
      }

      await gerarRelatorioPDF('comissionamento', payload);

      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error(getErrorMessage(error, 'Erro ao gerar relatório'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-serif font-bold text-navy mb-6">
            Relatório de Comissões
          </h1>

          <Card>
            <CardHeader>
              <CardTitle>Gerar Relatório PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Mês</label>
                    <Select
                      value={mes.toString()}
                      onValueChange={(val) => setMes(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {new Date(2000, m - 1).toLocaleDateString('pt-BR', {
                              month: 'long',
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Ano</label>
                    <Select
                      value={ano.toString()}
                      onValueChange={(val) => setAno(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: 10 },
                          (_, i) => new Date().getFullYear() - i
                        ).map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Funcionário (opcional)
                  </label>
                  <Select
                    value={funcionarioId}
                    onValueChange={setFuncionarioId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os funcionários</SelectItem>
                      {funcionarios.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.nome} ({f.tipo === 'F' ? 'Funcionário' : 'Parceiro'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleGerarPDF}
                    loading={loading}
                    size="large"
                    className="bg-navy hover:bg-navy/90"
                  >
                    Gerar Relatório PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sobre o Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Este relatório apresenta um detalhamento completo das comissões
                  de funcionários e parceiros para o período selecionado.
                </p>
                <p className="font-medium">O relatório inclui:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Data de cada pagamento recebido</li>
                  <li>Nome do cliente associado ao pagamento</li>
                  <li>Valor do pagamento realizado</li>
                  <li>Percentual de comissão aplicado</li>
                  <li>Valor da comissão calculada</li>
                  <li>Total de comissões por funcionário/parceiro</li>
                  <li>Total geral de comissões do período</li>
                </ul>
                <p className="mt-4 text-xs">
                  <strong>Dica:</strong> Deixe o campo "Funcionário" como "Todos"
                  para gerar um relatório consolidado com todos os comissionados,
                  ou selecione um funcionário específico para ver apenas as
                  comissões dele.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
