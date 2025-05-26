import DialogBase from "@/components/dialogs/DialogBase";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Banco } from "@/services/bancos";

export default function BancoDialog({
  open,
  onClose,
  onSubmit,
  banco, // 🔥 Banco para edição (ou null para criar)
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  banco?: Banco | null;
}) {
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    saldo_inicial: "",
  });

  // 🔥 Preenche os campos quando recebe um banco para edição
  useEffect(() => {
    if (banco) {
      setFormData({
        nome: banco.nome || "",
        descricao: banco.descricao || "",
        saldo_inicial: banco.saldo_inicial || "",
      });
    } else {
      // Se não há banco, limpa os campos (para criação)
      setFormData({
        nome: "",
        descricao: "",
        saldo_inicial: "",
      });
    }
  }, [banco, open]);

  const handleSubmit = () => {
    const payload = {
      nome: formData.nome,
      descricao: formData.descricao,
      saldo_inicial: Number(formData.saldo_inicial),
    };
    onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={banco ? "Editar Conta Bancária" : "Nova Conta Bancária"}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-6">
        {/* 🔹 Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium block">Nome da Conta</label>
            <Input
              placeholder="Ex.: Itaú PJ, Nubank, Caixa"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium block">Saldo Inicial</label>
            <Input
              type="number"
              placeholder="R$"
              value={formData.saldo_inicial}
              onChange={(e) =>
                setFormData({ ...formData, saldo_inicial: e.target.value })
              }
            />
          </div>
        </div>

        {/* 🔹 Linha 2 */}
        <div className="space-y-1">
          <label className="text-sm font-medium block">Descrição</label>
          <Input
            placeholder="Ex.: Conta PJ usada para despesas fixas"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>
      </div>
    </DialogBase>
  );
}
