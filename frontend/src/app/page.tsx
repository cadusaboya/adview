"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { login, isLoggedIn } from "@/services/auth";
import { getErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Check if already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

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
      setIsSubmitting(true);
      await login(username, password, rememberMe);
      toast.success("Login realizado com sucesso!");
      window.location.href = "/dashboard";
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Usuário ou senha incorretos');
      toast.error(errorMessage);
      setPasswordError("Verifique suas credenciais e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Brand & Features */}
      <div className="hidden md:flex flex-col justify-center items-start flex-1 px-20 bg-gradient-to-br from-navy via-navy to-primary relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gold opacity-5 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <h1 className="text-5xl font-serif font-bold text-white mb-3">
            Vincor
          </h1>
          <div className="w-20 h-1 bg-gold mb-6"></div>
          <p className="text-lg text-white/80 mb-16 max-w-md leading-relaxed">
            Gestão financeira profissional para escritórios de advocacia
          </p>

          <div className="space-y-6 max-w-lg">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-gold rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-serif font-semibold text-white mb-1">
                  Controle por cliente
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Organize receitas e despesas vinculadas a cada cliente com precisão e facilidade
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-gold rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-serif font-semibold text-white mb-1">
                  Visão completa do fluxo de caixa
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Acompanhe entradas, saídas e saldos em tempo real com relatórios detalhados
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-gold rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-serif font-semibold text-white mb-1">
                  Automatização inteligente
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Elimine trabalho manual e dedique mais tempo ao exercício da advocacia
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-gold rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-serif font-semibold text-white mb-1">
                  Segurança e confiabilidade
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Sistema robusto desenvolvido especificamente para a realidade jurídica
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col justify-center items-center flex-1 px-8 bg-offWhite">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded border bg-white p-6 shadow-medium"
        >
          <h1 className="text-2xl font-serif font-bold text-navy mb-2">Acesso ao sistema</h1>
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
              <Checkbox
                id="lembrar"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label htmlFor="lembrar" className="cursor-pointer">Lembrar-me</Label>
            </div>

            <Button
              type="submit"
              variant="accent"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Não possui acesso?{" "}
            <a href="/cadastro" className="text-primary font-medium hover:underline">
              Teste o sistema agora mesmo
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}