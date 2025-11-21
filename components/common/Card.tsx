import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isInteractive?: boolean;
  title?: React.ReactNode;
  actionButton?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  onMouseEnter,
  onMouseLeave,
  isInteractive = false,
  title,
  actionButton,
}) => {
  const baseClasses =
    'glass-panel p-4 rounded-xl flex flex-col transition-all duration-300 tabular-nums';
  
  const interactiveClasses = isInteractive
    ? 'cursor-pointer hover:border-[rgba(var(--color-primary-rgb),0.5)] hover:shadow-[rgba(var(--color-primary-rgb),0.2)] hover:-translate-y-1'
    : '';

  const classes = [baseClasses, interactiveClasses, className].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {(title || actionButton) && (
        <div className="flex justify-between items-start gap-2">
          {title && <h3 className="text-lg font-semibold mb-4 text-[rgb(var(--color-primary))] tracking-tight">{title}</h3>}
          {actionButton && <div className="flex-shrink-0 -mt-1">{actionButton}</div>}
        </div>
      )}
      <div className="flex-grow h-full w-full">{children}</div>
    </div>
  );
};