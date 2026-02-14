'use client';

import { Modal } from 'antd';
import { IconLock, IconBrandWhatsapp } from '@tabler/icons-react';

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

const WHATSAPP_URL =
  'https://wa.me/5591984147769?text=Ol%C3%A1%21%20Gostaria%20de%20fazer%20upgrade%20do%20meu%20plano%20Vincor.';

export function UpgradeDialog({ open, onClose, feature }: UpgradeDialogProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
    >
      <div className="flex flex-col items-center text-center py-4 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 border border-amber-200">
          <IconLock size={32} className="text-amber-500" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Funcionalidade bloqueada
          </h2>
          <p className="text-sm text-gray-500">
            {feature ? (
              <>
                <span className="font-medium text-gray-700">{feature}</span> está disponível
                apenas nos planos <span className="font-medium">Profissional</span> e{' '}
                <span className="font-medium">Evolution</span>.
              </>
            ) : (
              <>
                Esta funcionalidade está disponível apenas nos planos{' '}
                <span className="font-medium">Profissional</span> e{' '}
                <span className="font-medium">Evolution</span>.
              </>
            )}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Entre em contato com nosso consultor para fazer o upgrade do seu plano.
          </p>
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
        >
          <IconBrandWhatsapp size={18} />
          Falar com consultor
        </a>

        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}
