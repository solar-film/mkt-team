'use client';

import { HiXMark } from 'react-icons/hi2';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} type="button">
            <HiXMark />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
