'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { MoreVertical } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type ActionItem = {
  label?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
};

interface ActionsDropdownProps {
  actions: ActionItem[];
  onOpen?: () => void;
}

export function ActionsDropdown({ actions, onOpen }: ActionsDropdownProps) {
  return (
    <DropdownMenu onOpenChange={(open) => open && onOpen?.()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none"
        >
          <MoreVertical className="w-4 h-4 text-gray-600" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action, index) => {
          if (action.divider) {
            return <DropdownMenuSeparator key={`divider-${index}`} />;
          }

          const Icon = action.icon;

          return (
            <DropdownMenuItem
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className={clsx(
                'flex items-center gap-2',
                action.danger &&
                  'text-red-600 focus:text-red-600 focus:bg-red-50'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{action.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
