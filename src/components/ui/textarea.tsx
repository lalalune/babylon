import React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.ComponentPropsWithoutRef<'textarea'>;

export const Textarea = ({ className, ...props }: TextareaProps) => {
  return (
    <textarea 
      className={cn(className)} 
      {...props}
    />
  );
};

