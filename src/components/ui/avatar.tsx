import React from 'react';
import { cn } from '@/lib/utils';

export type AvatarProps = React.ComponentPropsWithoutRef<'div'>;

export const Avatar = ({ children, className, ...props }: AvatarProps) => {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
};

export interface AvatarImageProps extends React.ComponentPropsWithoutRef<'img'> {
  src?: string;
  alt?: string;
}

export const AvatarImage = ({ src, alt, className, ...props }: AvatarImageProps) => {
  return (
    <img 
      src={src} 
      alt={alt} 
      className={cn(className)} 
      {...props}
    />
  );
};

export type AvatarFallbackProps = React.ComponentPropsWithoutRef<'div'>;

export const AvatarFallback = ({ children, className, ...props }: AvatarFallbackProps) => {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
};

