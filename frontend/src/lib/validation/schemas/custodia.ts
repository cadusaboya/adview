import { CustodiaCreate } from "@/types/custodias";
import { ValidationSchema } from "../schemas";
import { required, minValue, minLength } from "../validators";

export const custodiaCreateSchema: ValidationSchema<CustodiaCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  descricao: [], // Optional
  tipo: [required("Tipo é obrigatório")],
  cliente_id: [], // Optional but one of cliente_id or funcionario_id should be set (validated in component)
  funcionario_id: [], // Optional
  valor_total: [
    required("Valor total é obrigatório"),
    minValue(0.01, "Valor deve ser maior que zero"),
  ],
};
