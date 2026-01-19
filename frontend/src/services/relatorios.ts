// services/relatorios.ts

import { api } from "./api";

export async function getRelatorioCliente(clienteId: number) {
  const response = await api.get(
    `/api/relatorios/cliente/${clienteId}/`
  );

  return response.data;
}

/* ======================
   RELATÓRIO FUNCIONÁRIO
====================== */
export async function getRelatorioFuncionario(funcionarioId: number) {
  const response = await api.get(
    `/api/relatorios/funcionario/${funcionarioId}/`
  );

  return response.data;
}