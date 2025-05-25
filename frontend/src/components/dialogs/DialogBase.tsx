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
}

export default function DialogBase({
  open,
  onClose,
  title,
  onSubmit,
  children,
}: DialogBaseProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* 🔥 Conteúdo rola junto com o Dialog */}
        <div className="space-y-6">
          {children}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {onSubmit && (
            <Button onClick={onSubmit}>
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
