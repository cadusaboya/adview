import { FuncionarioCreate } from "@/types/funcionarios";
import { ValidationSchema } from "../schemas";
import { required, email, phone, cpf, minLength } from "../validators";

export const funcionarioCreateSchema: ValidationSchema<FuncionarioCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cpf: [cpf() as any], // Optional but validates if provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  email: [email() as any], // Optional but validates if provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  telefone: [phone() as any], // Optional but validates if provided
  aniversario: [], // Optional
  tipo: [required("Tipo é obrigatório")],
  salario_mensal: [], // Optional, conditional validation in component
};
