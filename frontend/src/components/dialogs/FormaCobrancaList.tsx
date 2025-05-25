import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export interface FormaCobrancaItem {
  id: string;
  formato: "M" | "E";
  descricao?: string;
  valor?: string; // 🔥 Um único campo genérico para valor ou % exito
}

interface Props {
  formas: FormaCobrancaItem[];
  setFormas: (formas: FormaCobrancaItem[]) => void;
}

export default function FormaCobrancaList({ formas, setFormas }: Props) {
  const handleChange = (id: string, key: string, value: string) => {
    const atualizadas = formas.map((f) =>
      f.id === id ? { ...f, [key]: value } : f
    );
    setFormas(atualizadas);
  };

  const handleAdd = () => {
    setFormas([
      ...formas,
      {
        id: crypto.randomUUID(),
        formato: "M",
        descricao: "",
        valor: "",
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setFormas(formas.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-md font-semibold">Formas de Cobrança</h3>
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
            {/* 🔸 Formato */}
            <div className="md:col-span-2">
              <label className="text-sm">Formato</label>
              <Select
                value={forma.formato}
                onValueChange={(val) => handleChange(forma.id, "formato", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Mensal</SelectItem>
                  <SelectItem value="E">Êxito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 🔸 Descrição */}
            <div className="md:col-span-6">
              <label className="text-sm">Descrição</label>
              <Input
                placeholder="Ex.: Trabalhista, Tributário"
                value={forma.descricao || ""}
                onChange={(e) =>
                  handleChange(forma.id, "descricao", e.target.value)
                }
              />
            </div>

            {/* 🔸 Valor */}
            <div className="md:col-span-3">
              <label className="text-sm">
                {forma.formato === "M" ? "Valor Mensal (R$)" : "% Êxito"}
              </label>
              <Input
                type="number"
                placeholder={forma.formato === "M" ? "Ex.: 5000" : "Ex.: 30"}
                value={forma.valor || ""}
                onChange={(e) =>
                  handleChange(forma.id, "valor", e.target.value)
                }
              />
            </div>

            {/* 🔸 Botão remover */}
            <div className="md:col-span-1 flex justify-end">
              <Button variant="destructive" onClick={() => handleRemove(forma.id)}>
                Remover
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
