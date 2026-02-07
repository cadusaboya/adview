import { FuncionarioCreate } from "@/types/funcionarios";
import { ValidationSchema } from "../schemas";
import { required, email, phone, cpf, minLength } from "../validators";

export const funcionarioCreateSchema: ValidationSchema<FuncionarioCreate> = {
  nome: [
    required("Nome é obrigatório"),
    minLength(3, "Nome deve ter pelo menos 3 caracteres"),
  ],
  cpf: [cpf()], // Optional but validates if provided
  email: [email()], // Optional but validates if provided
  telefone: [phone()], // Optional but validates if provided
  aniversario: [], // Optional
  tipo: [required("Tipo é obrigatório")],
  salario_mensal: [], // Optional, conditional validation in component
};
