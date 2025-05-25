'use client';

import { useState } from 'react';
import { Group, Box, Collapse, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import classes from './NavbarLinksGroup.module.css';

interface LinksGroupProps {
  icon: React.FC<any>;
  label: string;
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
  link?: string;
}

export function LinksGroup({ icon: Icon, label, initiallyOpened, links, link }: LinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const [opened, setOpened] = useState(initiallyOpened || false);

  const items = (hasLinks ? links : []).map((l) => (
    <Link className={classes.link} href={l.link} key={l.label}>
      {l.label}
    </Link>
  ));

  if (hasLinks) {
    return (
      <>
        <UnstyledButton onClick={() => setOpened((o) => !o)} className={classes.control}>
          <Box className={classes.mainLink}>
            <ThemeIcon variant="light" size={30}>
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
        <ThemeIcon variant="light" size={30}>
          <Icon style={{ width: rem(18), height: rem(18) }} />
        </ThemeIcon>
        <Box ml="md">{label}</Box>
      </Box>
    </Link>
  );
}
