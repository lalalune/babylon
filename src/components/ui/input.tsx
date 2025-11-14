import React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.ComponentPropsWithoutRef<'input'>;

export const Input = ({ className, ...props }: InputProps) => {
  return (
    <input 
      className={cn(className)} 
      {...props}
    />
  );
};

