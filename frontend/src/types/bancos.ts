// types/banco.ts

// Entidade vinda da API
export interface Banco {
    id: number;
    nome: string;
    descricao: string;
    saldo_inicial: number;
    saldo_atual: number;
    company: number;
    criado_em: string;
    atualizado_em: string;
  }
  
  // Payload para criação
  export type BancoCreate = {
    nome: string;
    descricao: string;
    saldo_inicial: number;
  };
  
  // Payload para atualização
  export type BancoUpdate = Partial<BancoCreate>;
  