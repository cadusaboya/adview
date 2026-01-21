// 🔹 Filtros para relatórios de lista
export interface RelatorioFiltros {
    start_date?: string;
    end_date?: string;
    favorecido_id?: number;
    cliente_id?: number;
    situacao?: string;
  }
  
  // 🔹 Payload para recibos (entidade única)
  export interface RelatorioReciboPayload {
    payment_id: number;
  }
  