"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { login } from "@/services/auth";
import { getErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    if (!username) {
      setUsernameError("Por favor, insira seu usuário.");
      hasError = true;
    } else {
      setUsernameError("");
    }

    if (!password) {
      setPasswordError("Por favor, insira sua senha.");
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) return;

    try {
      await login(username, password);
      toast.success("Login realizado com sucesso!");
      router.push("/clientes");
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Erro ao buscar dados'));
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* 🔹 Esquerda */}
      <div className="hidden md:flex flex-col justify-center items-start flex-1 px-20 bg-white">
        <h1 className="text-2xl font-bold text-blue-700 mb-2">
          ⚖️ ADView
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Gestão financeira simples e eficiente para escritórios de advocacia.
        </p>

        <div className="space-y-8">
          <div>
            <h2 className="font-semibold">
              💼 Financeiro por cliente e processo
            </h2>
            <p className="text-sm text-muted-foreground">
              Organize receitas e despesas vinculadas a cada cliente ou caso jurídico.
            </p>
          </div>

          <div>
            <h2 className="font-semibold">📊 Visão clara do caixa</h2>
            <p className="text-sm text-muted-foreground">
              Acompanhe entradas, saídas e saldos em tempo real, sem planilhas.
            </p>
          </div>

          <div>
            <h2 className="font-semibold">⏱️ Menos tempo com números</h2>
            <p className="text-sm text-muted-foreground">
              Automatize rotinas financeiras e foque no que realmente importa: advogar.
            </p>
          </div>

          <div>
            <h2 className="font-semibold">🔒 Seguro e profissional</h2>
            <p className="text-sm text-muted-foreground">
              Controle financeiro confiável, pensado para a realidade jurídica.
            </p>
          </div>
        </div>
      </div>

      {/* 🔸 Direita */}
      <div className="flex flex-col justify-center items-center flex-1 px-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-md"
        >
          <h1 className="text-2xl font-bold mb-2">Acesso ao sistema</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Entre com suas credenciais para acessar o financeiro do escritório.
          </p>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="usuario">Usuário</Label>
              <Input
                id="usuario"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {usernameError && (
                <p className="text-sm text-red-500">{usernameError}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="lembrar" />
              <Label htmlFor="lembrar">Lembrar-me</Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-b from-neutral-900 to-neutral-700"
            >
              Entrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}