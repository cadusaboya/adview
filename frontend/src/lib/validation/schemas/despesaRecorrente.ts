import { DespesaRecorrenteCreate } from "@/types/despesasRecorrentes";
import { ValidationSchema } from "../schemas";
import { required, minValue, minLength } from "../validators";

export const despesaRecorrenteCreateSchema: ValidationSchema<DespesaRecorrenteCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  descricao: [], // Optional
  responsavel_id: [
    required("Responsável é obrigatório"),
    minValue(1, "Selecione um responsável"),
  ],
  valor: [
    required("Valor é obrigatório"),
    minValue(0.01, "Valor deve ser maior que zero"),
  ],
  tipo: [required("Tipo é obrigatório")],
  forma_pagamento: [], // Optional
  data_inicio: [required("Data de início é obrigatória")],
  data_fim: [], // Optional
  dia_vencimento: [
    required("Dia de vencimento é obrigatório"),
    minValue(1, "Dia deve ser entre 1 e 31"),
  ],
  status: [], // Optional
};
