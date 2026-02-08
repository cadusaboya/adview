import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  isBulk?: boolean;
  itemCount?: number;
}

export function DeleteConfirmationDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  itemName,
  isBulk = false,
  itemCount = 0,
}: DeleteConfirmationDialogProps) {
  const defaultTitle = isBulk
    ? 'Excluir itens selecionados?'
    : 'Confirmar exclusão';

  const defaultDescription = isBulk
    ? `Você está prestes a excluir ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}. Esta ação não pode ser desfeita.`
    : itemName
    ? `Você está prestes a excluir "${itemName}". Esta ação não pode ser desfeita.`
    : 'Esta ação é irreversível e não pode ser desfeita.';

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
