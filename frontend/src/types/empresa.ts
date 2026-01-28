// API Response Entity
export interface Empresa {
  id: number;
  name: string;
  cnpj?: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  email?: string;
  logo?: string | null;
  criado_em: string;
}

// Update Payload (only fields that can be edited)
export type EmpresaUpdate = {
  name?: string;
  cnpj?: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  email?: string;
};
