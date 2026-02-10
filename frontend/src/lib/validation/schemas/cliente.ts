import { ClienteCreate } from "@/types/clientes";
import { ValidationSchema } from "../schemas";
import { required, email, phone, cpfOrCnpj, minLength } from "../validators";

export const clienteCreateSchema: ValidationSchema<ClienteCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cpf: [cpfOrCnpj() as any], // Type cast needed for optional field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  email: [email() as any], // Type cast needed for optional field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  telefone: [phone() as any], // Type cast needed for optional field
  tipo: [required("Tipo de cliente é obrigatório")],
  aniversario: [], // Optional
  // Note: formas_cobranca and comissoes validation handled in component
};
