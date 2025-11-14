import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.ComponentPropsWithoutRef<'span'> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export const Badge = ({ children, variant: _variant, className, ...props }: BadgeProps) => {
  return (
    <span 
      className={cn(className)} 
      {...props}
    >
      {children}
    </span>
  );
};
export const badgeVariants = () => '';

