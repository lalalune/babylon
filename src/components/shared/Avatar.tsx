'use client'

import { cn, sanitizeId } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface AvatarProps {
  id?: string
  name?: string
  type?: 'actor' | 'business' | 'user'
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  scaleFactor?: number
  imageUrl?: string
}

interface GroupAvatarProps {
  members: Array<{ id: string; name: string; type?: 'actor' | 'business' | 'user' }>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
}

export function Avatar({ id, name, type = 'actor', src, alt, size = 'md', className, scaleFactor = 1, imageUrl }: AvatarProps) {
  const [primaryImageError, setPrimaryImageError] = useState(false)
  const [fallbackImageError, setFallbackImageError] = useState(false)

  // Determine the image path to use:
  // 1. If src is provided directly (uploaded profile image), use it
  // 2. Otherwise, use imageUrl if provided
  // 3. Finally, construct from id (static actor/org image)
  let imagePath: string | undefined
  let fallbackPath: string | undefined
  
  if (src) {
    imagePath = src
  } else if (imageUrl) {
    imagePath = imageUrl
  } else if (id) {
    const sanitizedId = sanitizeId(id)
    if (type === 'business') {
      imagePath = `/images/organizations/${sanitizedId}.jpg`
    } else if (type === 'user') {
      // User avatars should only use src/imageUrl props
      // Don't try to load static images for users
      imagePath = undefined
    } else {
      imagePath = `/images/actors/${sanitizedId}.jpg`
    }
  }

  // Generate deterministic fallback based on id
  if (id && !src && !imageUrl) {
    // Hash the id to get a number between 1-100
    const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const profileNum = (hash % 100) + 1
    fallbackPath = `/assets/user-profiles/profile-${profileNum}.jpg`
  }

  // Display name is alt (if provided) or name (if provided) or first letter of id
  const displayName = alt || name || (id ? id : 'User')
  const initial = displayName.charAt(0).toUpperCase()

  // Reset error flags when source changes
  useEffect(() => {
    setPrimaryImageError(false)
    setFallbackImageError(false)
  }, [imagePath])

  // Base sizes in rem
  const baseSizes = {
    sm: 2,    // 32px
    md: 2.5,  // 40px
    lg: 3.5,  // 56px
  }

  const scaledSize = baseSizes[size] * scaleFactor
  
  // Determine which image to show based on error states
  let currentImagePath: string | undefined
  if (!primaryImageError && imagePath) {
    // Try primary image first
    currentImagePath = imagePath
  } else if (!fallbackImageError && fallbackPath) {
    // If primary failed, try fallback
    currentImagePath = fallbackPath
  }
  
  const hasImage = Boolean(currentImagePath)

  // Check if className includes w-full h-full (for containers that should fill parent)
  const shouldFillParent = className?.includes('w-full') && className?.includes('h-full')

  const handleImageError = () => {
    if (!primaryImageError) {
      // Primary image failed
      setPrimaryImageError(true)
    } else {
      // Fallback image failed
      setFallbackImageError(true)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full bg-sidebar/40',
        hasImage ? '' : 'bg-primary/20 text-primary font-bold',
        // Don't add size classes if shouldFillParent
        !shouldFillParent && sizeClasses[size],
        className
      )}
      style={shouldFillParent ? {
        fontSize: `${scaleFactor}rem`
      } : {
        width: `${scaledSize}rem`,
        height: `${scaledSize}rem`,
        fontSize: `${scaleFactor}rem`
      }}
    >
      {hasImage ? (
        <img
          src={currentImagePath}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </div>
  )
}

export function GroupAvatar({ members, size = 'md', className }: GroupAvatarProps) {
  // Show up to 3 members in overlapping squares
  const displayMembers = members.slice(0, 3)

  if (displayMembers.length === 0) {
    return (
      <div className={cn(
        'bg-primary/20 flex items-center justify-center',
        sizeClasses[size],
        className
      )}>
        <div className="text-primary font-bold">G</div>
      </div>
    )
  }

  if (displayMembers.length === 1) {
    const member = displayMembers[0];
    if (!member) {
      return (
        <div className={cn(
          'bg-primary/20 flex items-center justify-center',
          sizeClasses[size],
          className
        )}>
          <div className="text-primary font-bold">G</div>
        </div>
      );
    }
    return <Avatar id={member.id} name={member.name} type={member.type} size={size} className={className} />
  }

  // Overlapping avatars
  const overlappingSizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      {displayMembers.map((member, index) => (
        <div
          key={member.id}
          className={cn(
            'absolute bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-background',
            overlappingSizeClasses[size]
          )}
          style={{
            left: `${index * (size === 'sm' ? 12 : size === 'md' ? 16 : 20)}px`,
            zIndex: displayMembers.length - index,
          }}
        >
          <Avatar
            {...member}
            size={size === 'lg' ? 'md' : 'sm'}
            className="w-full h-full border-0"
          />
        </div>
      ))}
      {/* Spacer to prevent content overlap */}
      <div
        className={cn(overlappingSizeClasses[size])}
        style={{
          marginRight: `${(displayMembers.length - 1) * (size === 'sm' ? 12 : size === 'md' ? 16 : 20)}px`
        }}
      />
    </div>
  )
}
