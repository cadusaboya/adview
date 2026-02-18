import { BancoCreate } from "@/types/bancos";
import { ValidationSchema } from "../schemas";
import { required, minLength } from "../validators";

export const bancoCreateSchema: ValidationSchema<BancoCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  descricao: [required("Descrição é obrigatória")],
  saldo_atual: [],
};
