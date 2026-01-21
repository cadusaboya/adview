// =======================
// Entidade vinda da API
// =======================
export interface Funcionario {
    id: number;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    aniversario: string | null;
    tipo: 'F' | 'P' | 'C'; // Funcionário, Parceiro, Colaborador
    tipo_display: string;
    salario_mensal: number | null;
  }
  
  // =======================
  // Payloads
  // =======================
  export type FuncionarioCreate = {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    aniversario: string | null;
    tipo: 'F' | 'P' | 'C';
    salario_mensal: number | null;
  };
  
  export type FuncionarioUpdate = Partial<FuncionarioCreate>;
  