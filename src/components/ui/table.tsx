import React from 'react';
import { cn } from '@/lib/utils';

export const Table = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
  <div className="relative w-full overflow-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'thead'>) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'tbody'>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props}>
    {children}
  </tbody>
);

export const TableFooter = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'tfoot'>) => (
  <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props}>
    {children}
  </tfoot>
);

export const TableRow = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'tr'>) => (
  <tr 
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )} 
    {...props}
  >
    {children}
  </tr>
);

export const TableHead = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
  <th
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  >
    {children}
  </th>
);

export const TableCell = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
  <td
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  >
    {children}
  </td>
);

export const TableCaption = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'caption'>) => (
  <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props}>
    {children}
  </caption>
);

