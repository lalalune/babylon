'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ArrowRight, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { useRouter } from 'next/navigation'

interface ApiEntity {
  id: string
  name: string
  username?: string
  bio?: string
  imageUrl?: string
}

interface RegistryEntity {
  id: string
  name: string
  username?: string
  bio?: string
  imageUrl?: string
}

interface EntitySearchAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  compact?: boolean
  onNavigate?: () => void
}

export function EntitySearchAutocomplete({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  compact = false,
  onNavigate,
}: EntitySearchAutocompleteProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<RegistryEntity[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!value.trim()) {
        setSuggestions([])
        setIsOpen(false)
        setSelectedIndex(-1)
        return
      }

      setLoading(true)
      const response = await fetch(`/api/registry/all?search=${encodeURIComponent(value)}`)
      if (response.ok) {
        const data = await response.json()
        const users: RegistryEntity[] = (data.users || []).map((u: ApiEntity) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          bio: u.bio,
          imageUrl: u.imageUrl,
        }))
        setSuggestions(users.slice(0, 10))
        setIsOpen(true)
        setSelectedIndex(users.length ? 0 : -1)
      } else {
        setSuggestions([])
        setIsOpen(false)
        setSelectedIndex(-1)
      }
      setLoading(false)
    }

    const timer = setTimeout(fetchSuggestions, 250)
    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navigateToEntity = (entity: RegistryEntity) => {
    if (entity.username) {
      router.push(`/profile/${entity.username}`)
      onNavigate?.()
      setIsOpen(false)
      setSelectedIndex(-1)
      onChange('')
    }
  }

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (event.key === 'Enter' && suggestions.length > 0 && suggestions[0]) {
          event.preventDefault()
          navigateToEntity(suggestions[0])
        }
        return
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : suggestions.length - 1,
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
          break
        case 'Enter':
          event.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            const entity = suggestions[selectedIndex]
            if (entity) {
              navigateToEntity(entity)
            }
          } else if (suggestions.length > 0) {
            const entity = suggestions[0]
            if (entity) {
              navigateToEntity(entity)
            }
          }
          break
        case 'Escape':
          setIsOpen(false)
          setSelectedIndex(-1)
          break
      }
    },
    [isOpen, suggestions, selectedIndex],
  )

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 pointer-events-none z-10',
          compact ? 'left-3' : 'left-4',
        )}
      >
        <Search className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4', 'text-primary')} />
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (value.trim() && suggestions.length > 0) {
            setIsOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full',
          'bg-muted/50 border border-border',
          'focus:outline-none focus:border-border',
          'transition-all duration-200',
          'text-foreground',
          compact ? 'pl-9 pr-9 py-1.5 text-sm' : 'pl-11 pr-10 py-2.5',
          'rounded-full',
        )}
      />
      {value && (
        <button
          onClick={() => {
            onChange('')
            setSuggestions([])
            setIsOpen(false)
            setSelectedIndex(-1)
          }}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 hover:bg-muted/50 p-1 transition-colors z-10',
            compact ? 'right-2' : 'right-3',
          )}
        >
          <X className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4', 'text-muted-foreground')} />
        </button>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden max-h-[400px] overflow-y-auto">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Search for &quot;{value}&quot;
              </p>
              <p className="text-xs text-muted-foreground">
                Select a user to jump to their profile
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>

          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
          )}

          {!loading && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matching users found
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Users
              </div>
              {suggestions.map((entity, index) => (
                <button
                  key={entity.id}
                  onClick={() => navigateToEntity(entity)}
                  className={cn(
                    'w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left',
                    selectedIndex === index && 'bg-muted/50',
                  )}
                >
                  <Avatar
                    src={entity.imageUrl || undefined}
                    name={entity.name}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{entity.name}</p>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs font-medium bg-[#0066FF]/10 text-[#0066FF] shrink-0">
                        <UserCircle className="w-4 h-4" />
                        User
                      </span>
                    </div>
                    {entity.username && (
                      <p className="text-xs text-muted-foreground truncate">@{entity.username}</p>
                    )}
                    {!entity.username && entity.bio && (
                      <p className="text-xs text-muted-foreground truncate">{entity.bio}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        input::placeholder {
          color: hsl(var(--muted-foreground));
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}


