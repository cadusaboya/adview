'use client';

import {
  IconGauge,
  IconCurrencyDollar,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
  IconUserCog,
  IconFileAnalytics,
  IconBuilding,
} from '@tabler/icons-react';
import { Code, Group, ScrollArea } from '@mantine/core';
import classes from './NavbarNested.module.css';
import { LinksGroup } from '../Navbar/NavbarLinksGroup';

const menuItems = [
  { label: 'Dashboard', icon: IconGauge, link: '/dashboard' },

  {
    label: 'Despesas',
    icon: IconTrendingDown,
    initiallyOpened: true,
    links: [
      { label: 'Contas a pagar', link: '/despesas/pagar' },
      { label: 'Contas pagas', link: '/despesas/pagas' },
    ],
  },

  {
    label: 'Receitas',
    icon: IconTrendingUp,
    initiallyOpened: true,
    links: [
      { label: 'Contas a receber', link: '/receitas/receber' },
      { label: 'Contas recebidas', link: '/receitas/recebidas' },
    ],
  },

  { label: 'Clientes', icon: IconUsers, link: '/clientes' },
  { label: 'Fornecedores', icon: IconUsers, link: '/fornecedores' },
  { label: 'Funcionários', icon: IconUserCog, link: '/funcionarios' },
  { label: 'Bancos', icon: IconCurrencyDollar, link: '/bancos' },
  { label: 'Empresa', icon: IconBuilding, link: '/empresa' },
  {
    label: 'Relatórios',
    icon: IconFileAnalytics,
    initiallyOpened: true,
    links: [
      { label: 'Demonstração de Resultado', link: '/relatorios/dre' },
      { label: 'Fluxo de Caixa', link: '/relatorios/fluxo' },
    ],
  },
];

export function NavbarNested() {
  const links = menuItems.map((item) => <LinksGroup {...item} key={item.label} />);

  return (
    <nav className={classes.navbar}>
      <div className={classes.header}>
        <Group justify="space-between">
          <Code fw={700}>Vincor</Code>
        </Group>
      </div>

      <ScrollArea className={classes.links} type="auto">
        <div className={classes.linksInner}>{links}</div>
      </ScrollArea>
    </nav>
  );
}
