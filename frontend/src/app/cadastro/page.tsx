'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/services/auth';
import { IconBuilding, IconUser, IconAt, IconLock, IconArrowRight, IconCheck, IconIdBadge2 } from '@tabler/icons-react';

interface FieldError {
  nome_empresa?: string;
  cpf_cnpj?: string;
  nome?: string;
  username?: string;
  email?: string;
  senha?: string;
  confirmar_senha?: string;
}

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

const VALID_PLANS = ['essencial', 'profissional', 'evolution'] as const;
const VALID_CICLOS = ['MONTHLY', 'ANNUAL'] as const;
type Plan = typeof VALID_PLANS[number];
type Ciclo = typeof VALID_CICLOS[number];

function CadastroForm() {
  const searchParams = useSearchParams();

  // Aceita ?plano= ou ?plan=, case-insensitive
  const planParam = (searchParams.get('plano') ?? searchParams.get('plan'))?.toLowerCase();
  const plan: Plan | null = VALID_PLANS.includes(planParam as Plan) ? (planParam as Plan) : null;

  // Aceita ?ciclo=, case-insensitive, default MONTHLY
  const cicloParam = searchParams.get('ciclo')?.toUpperCase() as Ciclo | undefined;
  const ciclo: Ciclo = VALID_CICLOS.includes(cicloParam as Ciclo) ? (cicloParam as Ciclo) : 'MONTHLY';

  const [form, setForm] = useState({
    nome_empresa: '',
    cpf_cnpj: '',
    nome: '',
    username: '',
    email: '',
    senha: '',
    confirmar_senha: '',
  });
  const [errors, setErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
    setApiError('');
  };

  const validate = (): boolean => {
    const errs: FieldError = {};
    if (!form.nome_empresa.trim()) errs.nome_empresa = 'Nome do escritório é obrigatório.';
    const cpfCnpjDigits = form.cpf_cnpj.replace(/\D/g, '');
    if (!cpfCnpjDigits) errs.cpf_cnpj = 'CPF ou CNPJ é obrigatório.';
    else if (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
      errs.cpf_cnpj = 'Informe um CPF ou CNPJ válido.';
    }
    if (!form.nome.trim()) errs.nome = 'Seu nome é obrigatório.';
    if (!form.username.trim()) errs.username = 'Nome de usuário é obrigatório.';
    if (!form.email.trim()) errs.email = 'E-mail é obrigatório.';
    if (!form.senha) errs.senha = 'Senha é obrigatória.';
    else if (form.senha.length < 8) errs.senha = 'Mínimo de 8 caracteres.';
    if (form.senha !== form.confirmar_senha) errs.confirmar_senha = 'As senhas não coincidem.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setApiError('');
    try {
      await register({
        nome_empresa: form.nome_empresa.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
        nome: form.nome.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        senha: form.senha,
      });
      if (plan) {
        sessionStorage.setItem('pending_plan', plan);
        sessionStorage.setItem('pending_ciclo', ciclo);
      }
      window.location.href = '/email-enviado';
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string> } })?.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrors: FieldError = {};
        if (data.nome_empresa) fieldErrors.nome_empresa = data.nome_empresa;
        if (data.cpf_cnpj) fieldErrors.cpf_cnpj = data.cpf_cnpj;
        if (data.username) fieldErrors.username = data.username;
        if (data.email) fieldErrors.email = data.email;
        if (data.senha) fieldErrors.senha = data.senha;
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors);
        } else {
          setApiError(data.detail || 'Erro ao criar conta. Tente novamente.');
        }
      } else {
        setApiError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* Left — Brand */}
      <div className="hidden lg:flex flex-col justify-between flex-1 px-16 py-12 bg-gradient-to-br from-[#0A192F] via-[#0A192F] to-[#0d2040] relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37] opacity-5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#D4AF37] opacity-5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <h1 className="text-4xl font-serif font-bold text-white tracking-tight">Vincor</h1>
          <div className="w-12 h-0.5 bg-[#D4AF37] mt-3 mb-1" />
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-3xl font-serif font-semibold text-white leading-snug mb-3">
            Chega de planilha. Seu escritório merece mais controle.
          </p>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            O Vincor centraliza tudo que você precisa para gerenciar o financeiro do seu escritório sem complicação.
          </p>

          <ul className="space-y-5">
            {[
              {
                title: 'Saiba exatamente o que cada cliente gera',
                desc: 'Visualize receitas por cliente, identifique os mais rentáveis e tome decisões com dados reais.',
              },
              {
                title: 'Comissões calculadas automaticamente',
                desc: 'Defina regras por advogado ou por cliente. O sistema calcula tudo sem fórmula, sem erro.',
              },
              {
                title: 'Relatórios prontos para clientes e sócios',
                desc: 'Exporte PDFs profissionais de DRE, fluxo de caixa e comissionamento em segundos.',
              },
              {
                title: '7 dias grátis, sem cartão de crédito',
                desc: 'Teste tudo sem compromisso. Cancele quando quiser.',
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center">
                  <IconCheck size={11} className="text-[#D4AF37]" />
                </span>
                <div>
                  <p className="text-white text-sm font-medium leading-snug">{item.title}</p>
                  <p className="text-white/45 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-white/25 text-xs">
          © {new Date().getFullYear()} Vincor · Todos os direitos reservados
        </p>
      </div>

      {/* Right — Form */}
      <div className="flex flex-col justify-center items-center flex-1 px-6 py-12 bg-[#F8F7F4] overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <p className="lg:hidden text-2xl font-serif font-bold text-[#0A192F] mb-8 text-center">Vincor</p>

          <h2 className="text-2xl font-serif font-bold text-[#0A192F] mb-1">Criar conta grátis</h2>
          <p className="text-sm text-gray-500 mb-8">
            7 dias de acesso completo, sem cartão de crédito.{' '}
            <Link href="/" className="text-[#0A192F] font-medium hover:underline">
              Já tem conta? Entrar
            </Link>
          </p>

          {apiError && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Escritório */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Nome do escritório
              </label>
              <div className="relative">
                <IconBuilding size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Silva & Souza Advogados"
                  value={form.nome_empresa}
                  onChange={set('nome_empresa')}
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                    errors.nome_empresa ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                  }`}
                />
              </div>
              {errors.nome_empresa && <p className="mt-1 text-xs text-red-500">{errors.nome_empresa}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                CPF / CNPJ
              </label>
              <div className="relative">
                <IconIdBadge2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={form.cpf_cnpj}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, cpf_cnpj: formatCpfCnpj(e.target.value) }));
                    setErrors(prev => ({ ...prev, cpf_cnpj: '' }));
                    setApiError('');
                  }}
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                    errors.cpf_cnpj ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                  }`}
                />
              </div>
              {errors.cpf_cnpj && <p className="mt-1 text-xs text-red-500">{errors.cpf_cnpj}</p>}
            </div>

            {/* Nome */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Seu nome
              </label>
              <div className="relative">
                <IconUser size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Carlos Silva"
                  value={form.nome}
                  onChange={set('nome')}
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                    errors.nome ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                  }`}
                />
              </div>
              {errors.nome && <p className="mt-1 text-xs text-red-500">{errors.nome}</p>}
            </div>

            {/* Username + Email side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Usuário
                </label>
                <div className="relative">
                  <IconUser size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="carlos.silva"
                    value={form.username}
                    onChange={set('username')}
                    autoComplete="username"
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                      errors.username ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                    }`}
                  />
                </div>
                {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <IconAt size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="carlos@escritorio.com"
                    value={form.email}
                    onChange={set('email')}
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                      errors.email ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                    }`}
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>
            </div>

            {/* Senha + Confirmar side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <IconLock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Mín. 8 caracteres"
                    value={form.senha}
                    onChange={set('senha')}
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                      errors.senha ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                    }`}
                  />
                </div>
                {errors.senha && <p className="mt-1 text-xs text-red-500">{errors.senha}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Confirmar senha
                </label>
                <div className="relative">
                  <IconLock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Repita a senha"
                    value={form.confirmar_senha}
                    onChange={set('confirmar_senha')}
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 ${
                      errors.confirmar_senha ? 'border-red-400' : 'border-gray-200 focus:border-[#0A192F]/40'
                    }`}
                  />
                </div>
                {errors.confirmar_senha && <p className="mt-1 text-xs text-red-500">{errors.confirmar_senha}</p>}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0d2040] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Criando conta...' : (
                <>
                  Começar trial gratuito
                  <IconArrowRight size={16} />
                </>
              )}
            </button>

          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Ao criar uma conta você concorda com nossos{' '}
            <a href="https://vincorapp.com.br/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">Termos de Uso</a>
            {' '}e{' '}
            <a href="https://vincorapp.com.br/privacidade" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">Política de Privacidade</a>.
          </p>

        </div>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroForm />
    </Suspense>
  );
}
