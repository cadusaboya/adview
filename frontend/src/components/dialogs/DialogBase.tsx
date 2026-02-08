"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DialogBaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit?: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  maxHeight?: string;
  compact?: boolean;
  loading?: boolean;
}

export default function DialogBase({
  open,
  onClose,
  title,
  onSubmit,
  children,
  size = 'xl',
  maxHeight = 'max-h-[90vh]',
  compact = false,
  loading = false,
}: DialogBaseProps) {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-3xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${sizeClasses[size]} ${maxHeight} flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Apenas o conteúdo rola, header e footer ficam fixos */}
        <div className={`overflow-y-auto flex-1 ${compact ? "space-y-4" : "space-y-6"}`}>
          {children}
        </div>

        <DialogFooter className={`flex-shrink-0 ${compact ? "mt-3" : "mt-6"}`}>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {onSubmit && (
            <Button variant="accent" onClick={onSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
