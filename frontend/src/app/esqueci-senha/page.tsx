"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/services/auth";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Por favor, insira seu email.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Brand */}
      <div className="hidden md:flex flex-col justify-center items-start flex-1 px-20 bg-gradient-to-br from-navy via-navy to-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gold opacity-5 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-5xl font-serif font-bold text-white mb-3">Vincor</h1>
          <div className="w-20 h-1 bg-gold mb-6"></div>
          <p className="text-lg text-white/80 max-w-md leading-relaxed">
            Gestão financeira profissional para escritórios de advocacia
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex flex-col justify-center items-center flex-1 px-8 bg-offWhite">
        <div className="w-full max-w-sm rounded border bg-white p-6 shadow-medium">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-serif font-bold text-navy mb-2">Email enviado</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Se esse email estiver cadastrado, você receberá um link para redefinir sua senha em breve.
              </p>
              <a href="/" className="text-sm text-primary font-medium hover:underline">
                Voltar ao login
              </a>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-serif font-bold text-navy mb-2">Esqueci minha senha</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Informe seu email cadastrado e enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
                <Button
                  type="submit"
                  variant="accent"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enviando..." : "Enviar link"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <a href="/" className="text-primary font-medium hover:underline">
                  Voltar ao login
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
