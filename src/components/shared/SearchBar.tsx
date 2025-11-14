'use client'

import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  compact?: boolean
}

export function SearchBar({ value, onChange, placeholder = 'Search...', className, compact = false }: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'absolute top-1/2 -translate-y-1/2 pointer-events-none',
        compact ? 'left-3' : 'left-4'
      )}>
        <Search className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} style={{ color: '#0066FF' }} />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full',
          'bg-muted/50 border-2',
          'focus:outline-none focus:ring-2 focus:ring-[#0066FF]',
          'transition-all duration-200',
          'text-foreground',
          compact 
            ? 'pl-9 pr-9 py-1.5 text-sm' 
            : 'pl-11 pr-10 py-2.5',
          'rounded-lg'
        )}
        style={{
          borderColor: '#0066FF',
          borderRadius: '2em',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 hover:bg-muted/50 p-1 transition-colors',
            compact ? 'right-2' : 'right-3'
          )}
        >
          <X className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4', 'text-muted-foreground')} />
        </button>
      )}
      <style jsx>{`
        input::placeholder {
          color: #0066FF;
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}
