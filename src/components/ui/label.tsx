import React from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = React.ComponentPropsWithoutRef<'label'>;

export const Label = ({ children, className, ...props }: LabelProps) => {
  return (
    <label className={cn(className)} {...props}>
      {children}
    </label>
  );
};

