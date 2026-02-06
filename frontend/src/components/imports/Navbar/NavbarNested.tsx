'use client';

import { useState, useEffect } from 'react';
import {
  IconGauge,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
  IconFileAnalytics,
  IconBuilding,
  IconLogout,
  IconAlertTriangle,
  IconReceipt,
} from '@tabler/icons-react';
import { Group, ScrollArea } from '@mantine/core';
import Image from 'next/image';
import classes from './NavbarNested.module.css';
import { LinksGroup } from '../Navbar/NavbarLinksGroup';
import { getMyEmpresa } from '@/services/empresa';
import { logout } from '@/services/auth';

const menuItems = [
  { label: 'Dashboard', icon: IconGauge, link: '/dashboard' },

  {
    label: 'Despesas',
    icon: IconTrendingDown,
    initiallyOpened: true,
    links: [
      { label: 'Contas a pagar', link: '/despesas/pagar' },
      { label: 'Contas pagas', link: '/despesas/pagas' },
      { label: 'Despesas Recorrentes', link: '/despesas-recorrentes' },
    ],
  },

  {
    label: 'Receitas',
    icon: IconTrendingUp,
    initiallyOpened: true,
    links: [
      { label: 'Contas a receber', link: '/receitas/receber' },
      { label: 'Contas recebidas', link: '/receitas/recebidas' },
      { label: 'Receitas Recorrentes', link: '/receitas-recorrentes' },
    ],
  },

  {
    label: 'Custódias',
    icon: IconAlertTriangle,
    initiallyOpened: true,
    links: [
      { label: 'A Receber', link: '/ativos' },
      { label: 'A Repassar', link: '/passivos' },
    ],
  },

  { label: 'Extrato', icon: IconReceipt, link: '/extrato' },

  {
    label: 'Empresa',
    icon: IconBuilding,
    initiallyOpened: true,
    links: [
      { label: 'Bancos', link: '/bancos' },
      { label: 'Configurações', link: '/empresa' },
    ],
  },

  {
    label: 'Pessoas',
    icon: IconUsers,
    initiallyOpened: true,
    links: [
      { label: 'Clientes', link: '/clientes' },
      { label: 'Fornecedores', link: '/fornecedores' },
      { label: 'Funcionários', link: '/funcionarios' },
    ],
  },

  {
    label: 'Relatórios',
    icon: IconFileAnalytics,
    initiallyOpened: true,
    links: [
      { label: 'Demonstração de Resultado', link: '/relatorios/dre' },
      { label: 'Fluxo de Caixa Realizado', link: '/relatorios/balanco' },
      { label: 'Fluxo de Caixa', link: '/relatorios/fluxo' },
      { label: 'Conciliação Bancária', link: '/relatorios/conciliacao' },
    ],
  },
];

export function NavbarNested() {
  const [companyName, setCompanyName] = useState<string>('');
  const links = menuItems.map((item) => <LinksGroup {...item} key={item.label} />);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const empresa = await getMyEmpresa();
        setCompanyName(empresa.name);
      } catch (error) {
        console.error('Erro ao carregar empresa:', error);
      }
    };
    loadCompany();
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className={classes.navbar}>
      <div className={classes.header}>
        <Group justify="center">
          <Image
            src="/vincor.png"
            alt="Vincor Logo"
            width={180}
            height={60}
            priority
            style={{ objectFit: 'contain' }}
          />
        </Group>
      </div>

      <ScrollArea className={classes.links} type="auto">
        <div className={classes.linksInner}>{links}</div>
      </ScrollArea>

      <div className={classes.footer}>
        {companyName && (
          <div className={classes.companyInfo}>
            <IconBuilding size={16} style={{ opacity: 0.7 }} />
            <span className={classes.companyName}>{companyName}</span>
          </div>
        )}
        <button className={classes.logoutButton} onClick={handleLogout}>
          <IconLogout size={18} />
          <span>Sair</span>
        </button>
      </div>
    </nav>
  );
}
