import { PaymentCreate } from "@/types/payments";
import { ValidationSchema } from "../schemas";
import { required, minValue } from "../validators";

export const paymentCreateSchema: ValidationSchema<PaymentCreate> = {
  tipo: [required("Tipo é obrigatório")],
  conta_bancaria: [
    required("Conta bancária é obrigatória"),
    minValue(1, "Selecione uma conta bancária"),
  ],
  valor: [
    required("Valor é obrigatório"),
    minValue(0.01, "Valor deve ser maior que zero"),
  ],
  data_pagamento: [required("Data do pagamento é obrigatória")],
  observacao: [], // Optional
};
