import { useState, useCallback } from 'react';

interface DeleteConfirmationState {
  isOpen: boolean;
  itemId: number | null;
  itemIds: number[];
  isBulk: boolean;
  itemName?: string;
}

interface UseDeleteConfirmationReturn {
  confirmState: DeleteConfirmationState;
  confirmDelete: (id: number, itemName?: string) => void;
  confirmBulkDelete: (ids: number[]) => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}

interface UseDeleteConfirmationOptions {
  onDelete: (id: number) => Promise<void>;
  onBulkDelete?: (ids: number[]) => Promise<void>;
}

export function useDeleteConfirmation({
  onDelete,
  onBulkDelete,
}: UseDeleteConfirmationOptions): UseDeleteConfirmationReturn {
  const [confirmState, setConfirmState] = useState<DeleteConfirmationState>({
    isOpen: false,
    itemId: null,
    itemIds: [],
    isBulk: false,
  });

  const confirmDelete = useCallback((id: number, itemName?: string) => {
    setConfirmState({
      isOpen: true,
      itemId: id,
      itemIds: [],
      isBulk: false,
      itemName,
    });
  }, []);

  const confirmBulkDelete = useCallback((ids: number[]) => {
    setConfirmState({
      isOpen: true,
      itemId: null,
      itemIds: ids,
      isBulk: true,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      if (confirmState.isBulk && onBulkDelete) {
        await onBulkDelete(confirmState.itemIds);
      } else if (confirmState.itemId !== null) {
        await onDelete(confirmState.itemId);
      }
    } finally {
      setConfirmState({
        isOpen: false,
        itemId: null,
        itemIds: [],
        isBulk: false,
      });
    }
  }, [confirmState, onDelete, onBulkDelete]);

  const handleCancel = useCallback(() => {
    setConfirmState({
      isOpen: false,
      itemId: null,
      itemIds: [],
      isBulk: false,
    });
  }, []);

  return {
    confirmState,
    confirmDelete,
    confirmBulkDelete,
    handleConfirm,
    handleCancel,
  };
}
