import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.ComponentPropsWithoutRef<'select'> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Select = ({ children, className, value, onValueChange, ...props }: SelectProps) => {
  return (
    <select 
      className={cn(className)} 
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...props}
    >
      {children}
    </select>
  );
};

export type SelectContentProps = React.ComponentPropsWithoutRef<'div'>;

export const SelectContent = ({ children, className, ...props }: SelectContentProps) => {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
};

export interface SelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: string;
}

export const SelectItem = ({ children, value, className, ...props }: SelectItemProps) => {
  return (
    <div className={cn(className)} data-value={value} {...props}>
      {children}
    </div>
  );
};

export type SelectTriggerProps = React.ComponentPropsWithoutRef<'button'>;

export const SelectTrigger = ({ children, className, ...props }: SelectTriggerProps) => {
  return (
    <button className={cn(className)} {...props}>
      {children}
    </button>
  );
};

export interface SelectValueProps {
  placeholder?: string;
}

export const SelectValue = ({ placeholder }: SelectValueProps) => {
  return <span>{placeholder}</span>;
};

