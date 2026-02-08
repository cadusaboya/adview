import { ReceitaCreate } from "@/types/receitas";
import { ValidationSchema } from "../schemas";
import { required, minValue, minLength } from "../validators";

export const receitaCreateSchema: ValidationSchema<ReceitaCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  descricao: [], // Optional
  cliente_id: [
    required("Cliente é obrigatório"),
    minValue(1, "Selecione um cliente"),
  ],
  valor: [
    required("Valor é obrigatório"),
    minValue(0.01, "Valor deve ser maior que zero"),
  ],
  data_vencimento: [required("Data de vencimento é obrigatória")],
  tipo: [required("Tipo é obrigatório")],
  forma_pagamento: [], // Optional
};
