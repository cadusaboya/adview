import { DespesaCreate } from "@/types/despesas";
import { ValidationSchema } from "../schemas";
import { required, minValue, minLength } from "../validators";

export const despesaCreateSchema: ValidationSchema<DespesaCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  responsavel_id: [
    required("Responsável é obrigatório"),
    minValue(1, "Selecione um responsável"),
  ],
  valor: [
    required("Valor é obrigatório"),
    minValue(0.01, "Valor deve ser maior que zero"),
  ],
  data_vencimento: [required("Data de vencimento é obrigatória")],
  tipo: [required("Tipo é obrigatório")],
  data_pagamento: [], // Optional
  situacao: [], // Optional
  num_parcelas: [], // Optional
};
