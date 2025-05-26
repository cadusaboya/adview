"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { login } from "@/services/auth";

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
      const data = await login(username, password);
      toast.success("Login realizado com sucesso!");
      router.push("/clientes");
    } catch (error: any) {
      console.error("Erro no login:", error);
      toast.error(
        error?.response?.data?.detail || "Usuário ou senha inválidos"
      );
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* 🔹 Esquerda */}
      <div className="hidden md:flex flex-col justify-center items-start flex-1 px-20 bg-white">
        <h1 className="text-2xl font-bold text-blue-700 mb-10">⚡ Sitemark</h1>

        <div className="space-y-8">
          <div>
            <h2 className="font-semibold">⚙️ Adaptable performance</h2>
            <p className="text-sm text-muted-foreground">
              Our product effortlessly adjusts to your needs, boosting efficiency and simplifying your tasks.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">🛠️ Built to last</h2>
            <p className="text-sm text-muted-foreground">
              Experience unmatched durability that goes above and beyond with lasting investment.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">👍 Great user experience</h2>
            <p className="text-sm text-muted-foreground">
              Integrate our product into your routine with an intuitive and easy-to-use interface.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">🪄 Innovative functionality</h2>
            <p className="text-sm text-muted-foreground">
              Stay ahead with features that set new standards, addressing your evolving needs better than the rest.
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
          <h1 className="text-2xl font-bold mb-6">Entrar</h1>

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
