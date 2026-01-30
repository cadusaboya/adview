export interface Favorecido {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  aniversario: string | null;
  tipo: 'F' | 'P' | 'O'; // Funcionário, Parceiro, Colaborador
  tipo_display: string;
  salario_mensal: string | null;
}
