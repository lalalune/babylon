import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = ({ children, variant: _variant, size: _size, className, ...props }: ButtonProps) => {
  return (
    <button 
      className={cn(className)} 
      {...props}
    >
      {children}
    </button>
  );
};
export const buttonVariants = () => '';
