import { TransferCreate } from "@/types/transfer";
import { ValidationSchema } from "../schemas";
import { required, minValue, custom } from "../validators";

export const transferCreateSchema: ValidationSchema<TransferCreate> = {
  from_bank_id: [
    required("Banco de origem é obrigatório"),
    custom<number>(
      (value, allValues) => {
        if (!allValues) return true;
        return value !== (allValues as TransferCreate).to_bank_id;
      },
      "As contas de origem e destino devem ser diferentes"
    ),
  ],
  to_bank_id: [required("Banco de destino é obrigatório")],
  valor: [
    required("Valor é obrigatório"),
    minValue(0.01, "Valor deve ser maior que zero"),
  ],
  data_transferencia: [required("Data da transferência é obrigatória")],
  descricao: [], // Optional field
};
