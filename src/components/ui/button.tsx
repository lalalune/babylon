import React from 'react';

export const Button = ({ children, ...props }: { children: React.ReactNode;[key: string]: unknown }) => <button {...props}>{children}</button>;
export const buttonVariants = () => '';
