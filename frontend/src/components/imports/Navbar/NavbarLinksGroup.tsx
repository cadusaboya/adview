'use client';

import { useState } from 'react';
import { Box, Collapse, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import { LucideIcon } from 'lucide-react';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import classes from './NavbarLinksGroup.module.css';

interface LinksGroupProps {
  icon: LucideIcon;
  label: string;
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
  link?: string;
  opened?: boolean;
  onToggle?: () => void;
}

export function LinksGroup({ icon: Icon, label, links, link, opened = false, onToggle }: LinksGroupProps) {
  const hasLinks = Array.isArray(links);

  const items = (hasLinks ? links : []).map((l) => (
    <Link className={classes.link} href={l.link} key={l.label}>
      {l.label}
    </Link>
  ));

  if (hasLinks) {
    return (
      <>
        <UnstyledButton onClick={onToggle} className={classes.control}>
          <Box className={classes.mainLink}>
            <ThemeIcon
              variant="light"
              size={30}
              style={{ backgroundColor: 'transparent', color: '#D4AF37' }}
            >
              <Icon style={{ width: rem(18), height: rem(18) }} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
            <IconChevronRight
              className={classes.chevron}
              stroke={1.5}
              style={{
                transform: opened ? 'rotate(90deg)' : 'none',
              }}
            />
          </Box>
        </UnstyledButton>
        <Collapse in={opened}>{items}</Collapse>
      </>
    );
  }

  return (
    <Link className={classes.control} href={link || '#'}>
      <Box className={classes.mainLink}>
        <ThemeIcon
          variant="light"
          size={30}
          style={{ backgroundColor: 'transparent', color: '#D4AF37' }}
        >
          <Icon style={{ width: rem(18), height: rem(18) }} />
        </ThemeIcon>
        <Box ml="md">{label}</Box>
      </Box>
    </Link>
  );
}
