import React, { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const useFocusTrap = (ref: React.RefObject<HTMLElement>, isOpen: boolean) => {
    useEffect(() => {
        if (!isOpen || !ref.current) return;

        const focusableElements = Array.from(ref.current.querySelectorAll(FOCUSABLE_SELECTORS)) as HTMLElement[];
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else { // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);

    }, [isOpen, ref]);
};


const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    isInfo?: boolean;
}> = ({ isOpen, onClose, title, children, isInfo = false }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<Element | null>(null);
    const titleId = `modal-title-${React.useId()}`;

    useFocusTrap(modalRef, isOpen);

    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement;
            setTimeout(() => {
                const focusableElements = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTORS);
                if (focusableElements && focusableElements.length > 0) {
                    (focusableElements[0] as HTMLElement).focus();
                } else {
                    modalRef.current?.focus();
                }
            }, 100); // Delay to allow animation
        } else if (triggerRef.current) {
            (triggerRef.current as HTMLElement).focus();
            triggerRef.current = null;
        }
    }, [isOpen]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" 
            onClick={onClose}
            onKeyDown={handleKeyDown}
        >
            <div 
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={`bg-slate-800/90 p-6 rounded-lg shadow-2xl w-11/12 flex flex-col border border-slate-700 animate-scale-in focus:outline-none ${isInfo ? 'max-w-lg' : 'h-[90%] max-w-7xl'}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 id={titleId} className="text-xl font-bold text-cyan-300">{title}</h2>
                    <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="flex-grow h-full w-full overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

export default Modal;