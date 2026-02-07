import { ClienteCreate } from "@/types/clientes";
import { ValidationSchema } from "../schemas";
import { required, email, phone, cpfOrCnpj, minLength } from "../validators";

export const clienteCreateSchema: ValidationSchema<ClienteCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  cpf: [cpfOrCnpj()],
  email: [email()],
  telefone: [phone()],
  tipo: [required("Tipo de cliente é obrigatório")],
  aniversario: [], // Optional
  comissionado_id: [], // Optional
  // Note: formas_cobranca validation handled in component
};
