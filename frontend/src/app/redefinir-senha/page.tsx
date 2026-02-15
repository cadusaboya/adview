"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import { confirmPasswordReset } from "@/services/auth";

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    if (!uid || !token) {
      setInvalidLink(true);
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (password.length < 8) {
      newErrors.password = "A senha deve ter pelo menos 8 caracteres.";
    }
    if (password !== confirmPassword) {
      newErrors.confirm = "As senhas não coincidem.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(uid, token, password);
      toast.success("Senha redefinida com sucesso!");
      router.push("/");
    } catch {
      setErrors({ general: "Link inválido ou expirado. Solicite um novo link." });
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
          {invalidLink ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-serif font-bold text-navy mb-2">Link inválido</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Este link é inválido ou expirou. Solicite um novo link de redefinição de senha.
              </p>
              <Link href="/esqueci-senha" className="text-sm text-primary font-medium hover:underline">
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-serif font-bold text-navy mb-2">Redefinir senha</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Crie uma nova senha para sua conta. Mínimo de 8 caracteres.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                    {errors.general}{" "}
                    <Link href="/esqueci-senha" className="underline font-medium">
                      Solicitar novo link
                    </Link>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="senha">Nova senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmar">Confirmar senha</Label>
                  <Input
                    id="confirmar"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {errors.confirm && <p className="text-sm text-red-500">{errors.confirm}</p>}
                </div>
                <Button
                  type="submit"
                  variant="accent"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Salvando..." : "Redefinir senha"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/" className="text-primary font-medium hover:underline">
                  Voltar ao login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
