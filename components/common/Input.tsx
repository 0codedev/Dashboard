import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  const classes = ['input-base', className].filter(Boolean).join(' ');
  return <input className={classes} {...props} />;
};
