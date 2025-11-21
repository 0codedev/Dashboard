import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isIconOnly?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isIconOnly = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'btn';

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };

  const sizeClasses = {
    sm: `text-xs ${isIconOnly ? 'p-1.5' : 'py-1 px-2'}`,
    md: `text-sm ${isIconOnly ? 'p-2' : 'py-2 px-4'}`,
    lg: `text-base ${isIconOnly ? 'p-3' : 'py-3 px-6'}`,
  };

  const iconOnlyClasses = isIconOnly ? 'btn-icon' : '';

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    iconOnlyClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};