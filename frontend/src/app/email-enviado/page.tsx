"use client";

import Link from "next/link";

export default function EmailEnviadoPage() {
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
          <div className="w-14 h-14 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-serif font-bold text-navy mb-2">Verifique seu email</h1>
          <p className="text-sm text-muted-foreground mb-2">
            Enviamos um link de confirmação para o email cadastrado.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Clique no link para ativar sua conta e fazer o primeiro acesso.
          </p>

          <div className="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 text-left mb-6">
            Não recebeu? Verifique também a pasta de spam ou lixo eletrônico.
          </div>

          <Link href="/" className="text-sm text-primary font-medium hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
