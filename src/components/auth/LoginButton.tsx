'use client'

import { Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function LoginButton() {
  const { ready, login } = useAuth()

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .neumorphic-login-button {
            box-shadow: inset 5px 5px 5px rgba(0, 0, 0, 0.1), inset -5px -5px 5px rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
          }

          .neumorphic-login-button:hover:not(:disabled) {
            box-shadow: none;
            background-color: #0066FF;
          }

          .neumorphic-login-button:hover:not(:disabled) * {
            color: #e4e4e4;
          }
        `
      }} />
      <button
        onClick={login}
        disabled={!ready}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold',
          'bg-sidebar-accent/30 neumorphic-login-button',
          'transition-all duration-300',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        style={{ color: '#0066FF' }}
      >
        <Wallet className="w-5 h-5" />
        <span>Connect Wallet</span>
      </button>
    </>
  )
}
