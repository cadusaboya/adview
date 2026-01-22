// =======================
// Entidade vinda da API
// =======================
export interface Fornecedor {
    id: number;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    aniversario: string | null;
    tipo: 'F' | 'P' | 'C' | 'O'; // Funcionário, Parceiro, Colaborador
    tipo_display: string;
    salario_mensal: number | null;
  }
  
  // =======================
  // Payloads
  // =======================
  export type FornecedorCreate = {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    aniversario: string | null;
    tipo: 'F' | 'P' | 'C' | 'O';
    salario_mensal: number | null;
  };
  
  export type FornecedorUpdate = Partial<FornecedorCreate>;
  