"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/services/auth";

type State = "loading" | "success" | "error" | "invalid";

function VerificarEmailForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<State>(uid && token ? "loading" : "invalid");

  useEffect(() => {
    if (!uid || !token) return;

    verifyEmail(uid, token)
      .then(() => setState("success"))
      .catch(() => setState("error"));
  }, [uid, token]);

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

      {/* Right Side */}
      <div className="flex flex-col justify-center items-center flex-1 px-8 bg-offWhite">
        <div className="w-full max-w-sm rounded border bg-white p-8 shadow-medium text-center">

          {state === "loading" && (
            <>
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-5"></div>
              <h2 className="text-xl font-serif font-bold text-navy mb-2">Verificando seu email...</h2>
              <p className="text-sm text-muted-foreground">Aguarde um momento.</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-serif font-bold text-navy mb-2">Email confirmado!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Sua conta está ativa. Agora você pode fazer login e começar a usar o Vincor.
              </p>
              <Link
                href="/"
                className="inline-block w-full py-2.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Fazer login
              </Link>
            </>
          )}

          {(state === "error" || state === "invalid") && (
            <>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-serif font-bold text-navy mb-2">Link inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Este link de confirmação é inválido ou já expirou. Entre em contato com o suporte se precisar de ajuda.
              </p>
              <div className="space-y-3">
                <a
                  href="mailto:suporte@vincorapp.com.br"
                  className="inline-block w-full py-2.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Falar com suporte
                </a>
                <Link href="/" className="block text-sm text-primary font-medium hover:underline mt-2">
                  Voltar ao login
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense>
      <VerificarEmailForm />
    </Suspense>
  );
}
