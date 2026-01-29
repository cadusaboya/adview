import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  formatCurrencyInput,
  parseCurrencyBR,
} from "@/lib/formatters";
import { Trash2 } from "lucide-react";

export interface FormaCobrancaItem {
  id: string;
  formato: "M" | "E";
  descricao?: string;

  // 🔥 valor REAL (sempre sincronizado)
  valor?: number;

  // 🔥 valor VISUAL
  valor_display?: string;
}

interface Props {
  formas: FormaCobrancaItem[];
  setFormas: (formas: FormaCobrancaItem[]) => void;
}

export default function FormaCobrancaList({ formas, setFormas }: Props) {
  const updateForma = (id: string, data: Partial<FormaCobrancaItem>) => {
    setFormas(
      formas.map((f) => (f.id === id ? { ...f, ...data } : f))
    );
  };

  const handleAdd = () => {
    setFormas([
      ...formas,
      {
        id: crypto.randomUUID(),
        formato: "M",
        descricao: "",
        valor: undefined,
        valor_display: "",
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setFormas(formas.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Formas de Cobrança</h3>
        <Button variant="outline" onClick={handleAdd}>
          + Adicionar
        </Button>
      </div>

      {formas.map((forma) => (
        <div
          key={forma.id}
          className="border rounded-md p-4 space-y-2 bg-muted"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Formato */}
            <div className="md:col-span-2">
              <label className="text-sm">Formato</label>
              <Select
                value={forma.formato}
                onValueChange={(val) =>
                  updateForma(forma.id, {
                    formato: val as "M" | "E",
                    valor: undefined,
                    valor_display: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Mensal</SelectItem>
                  <SelectItem value="E">Êxito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="md:col-span-6">
              <label className="text-sm">Descrição</label>
              <Input
                value={forma.descricao || ""}
                onChange={(e) =>
                  updateForma(forma.id, { descricao: e.target.value })
                }
              />
            </div>

            {/* Valor */}
            <div className="md:col-span-3">
              <label className="text-sm">
                {forma.formato === "M"
                  ? "Valor Mensal (R$)"
                  : "% Êxito"}
              </label>

              <Input
                type="text"
                inputMode="decimal"
                value={forma.valor_display || ""}
                placeholder={forma.formato === "M" ? "0,00" : "Ex.: 30"}
                onChange={(e) => {
                  const raw = e.target.value;

                  if (forma.formato === "M") {
                    updateForma(forma.id, {
                      valor_display: raw,
                      valor: parseCurrencyBR(raw),
                    });
                  } else {
                    const num = Number(raw.replace(",", "."));
                    updateForma(forma.id, {
                      valor_display: raw,
                      valor: isNaN(num) ? undefined : num,
                    });
                  }
                }}
                onBlur={() => {
                  if (forma.formato === "M" && forma.valor) {
                    updateForma(forma.id, {
                      valor_display: formatCurrencyInput(forma.valor),
                    });
                  }
                }}
              />
            </div>

            {/* Remover */}
            <div className="md:col-span-1 flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRemove(forma.id)}
                title="Excluir forma de cobrança"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
