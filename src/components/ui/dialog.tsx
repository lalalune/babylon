import React from 'react';
import { cn } from '@/lib/utils';

export interface DialogProps extends React.ComponentPropsWithoutRef<'div'> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog = ({ children, open, onOpenChange, className, ...props }: DialogProps) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content Container */}
      <div className={cn('relative z-50', className)} {...props}>
        {children}
      </div>
    </div>
  );
};

export type DialogContentProps = React.ComponentPropsWithoutRef<'div'>;

export const DialogContent = ({ children, className, ...props }: DialogContentProps) => {
  return (
    <div 
      className={cn(
        'bg-background border border-border rounded-lg shadow-lg w-full',
        'animate-in fade-in-0 zoom-in-95 duration-200',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
};

export type DialogHeaderProps = React.ComponentPropsWithoutRef<'div'>;

export const DialogHeader = ({ children, className, ...props }: DialogHeaderProps) => {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
      {children}
    </div>
  );
};

export type DialogTitleProps = React.ComponentPropsWithoutRef<'h2'>;

export const DialogTitle = ({ children, className, ...props }: DialogTitleProps) => {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props}>
      {children}
    </h2>
  );
};

export type DialogDescriptionProps = React.ComponentPropsWithoutRef<'p'>;

export const DialogDescription = ({ children, className, ...props }: DialogDescriptionProps) => {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
};

export type DialogFooterProps = React.ComponentPropsWithoutRef<'div'>;

export const DialogFooter = ({ children, className, ...props }: DialogFooterProps) => {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props}>
      {children}
    </div>
  );
};

