"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import { useState } from "react";
import { ScrollArea } from "../ui/scroll-area"; // 🔥 ScrollArea importado

export interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  placeholder?: string;
  options?: { label: string; value: string }[]; // Para select
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: Field[];
  onSubmit: (formData: Record<string, string>) => void;
  onFieldChange?: (key: string, value: string) => void;
  children?: React.ReactNode;
}

export default function CreateDialog({
  open,
  onClose,
  title,
  fields,
  onSubmit,
  onFieldChange,
  children,
}: CreateDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (onFieldChange) {
      onFieldChange(key, value);
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
    setFormData({});
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* 🔥 Layout em duas colunas */}
        <div className="flex gap-6 h-full">
          {/* 🔹 Coluna esquerda - Campos simples */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-sm font-medium block">
                    {field.label}
                  </label>

                  {["text", "number", "date"].includes(field.type) && (
                    <Input
                      className="w-full sm:w-64"
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ""}
                      onChange={(e) =>
                        handleChange(field.key, e.target.value)
                      }
                    />

                  )}

                  {field.type === "select" && (
                    <Select
                      value={formData[field.key] || ""}
                      onValueChange={(val) =>
                        handleChange(field.key, val)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            field.placeholder || "Selecione"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 🔸 Coluna direita - Conteúdo adicional com Scroll */}
          <div className="flex-1">
            <ScrollArea className="max-h-[80vh] pr-4">
              {children}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
