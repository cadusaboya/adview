// 🔹 Entidade vinda da API
export interface FormaCobranca {
    id: number;
    formato: "M" | "E";
    descricao?: string;
    valor_mensal?: number | null;
    percentual_exito?: number | null;
  }
  
import { ComissaoRegra } from './comissoes';

  export interface Cliente {
    id: number;
    nome: string;
    cpf?: string;
    email?: string;
    telefone?: string;
    aniversario?: string;
    tipo: string;

    formas_cobranca?: FormaCobranca[];
    comissoes?: ComissaoRegra[];
  }


  export type FormaCobrancaPayload = {
    formato: "M" | "E";
    descricao?: string;
    valor_mensal?: number | null;
    percentual_exito?: number | null;
  };

  // 🔹 Payload de criação (o que o usuário envia)
  export type ClienteCreate = {
    nome: string;
    cpf?: string;
    email?: string;
    telefone?: string;
    aniversario?: string | null;
    tipo: string;
    formas_cobranca?: FormaCobrancaPayload[];
    comissoes?: { funcionario_id: number; percentual: number }[];
  };

  // 🔹 Payload de atualização (edição parcial)
  export type ClienteUpdate = Partial<ClienteCreate>;
  