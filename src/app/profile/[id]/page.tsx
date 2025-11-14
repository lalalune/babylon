'use client'

import { FollowButton } from '@/components/interactions/FollowButton'
import { OnChainBadge } from '@/components/profile/OnChainBadge'
import { ProfileWidget } from '@/components/profile/ProfileWidget'
import { PostCard } from '@/components/posts/PostCard'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { Avatar } from '@/components/shared/Avatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { PageContainer } from '@/components/shared/PageContainer'
import { ProfileHeaderSkeleton, FeedSkeleton } from '@/components/shared/Skeleton'
import { TradesFeed } from '@/components/trades/TradesFeed'
import { useAuth } from '@/hooks/useAuth'
import { useErrorToasts } from '@/hooks/useErrorToasts'
import { extractUsername, isUsername } from '@/lib/profile-utils'
import { getBannerImageUrl } from '@/lib/assets'
import { cn } from '@/lib/utils'
import { POST_TYPES } from '@/shared/constants'
import type { Actor, FeedPost, Organization } from '@/shared/types'
import { useGameStore } from '@/stores/gameStore'
import type { ProfileInfo } from '@/types/profiles'
import { ArrowLeft, MessageCircle, Search } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'

export default function ActorProfilePage() {
  const params = useParams()
  const router = useRouter()
  const identifier = decodeURIComponent(params.id as string)
  const isUsernameParam = isUsername(identifier)
  const actorId = isUsernameParam ? extractUsername(identifier) : identifier
  const { user, authenticated, getAccessToken } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'posts' | 'replies' | 'trades'>('posts')
  const { allGames } = useGameStore();
  const [optimisticFollowerCount, setOptimisticFollowerCount] = useState<number | null>(null)
  
  // Check if viewing own profile - compare with both actorId and identifier (for ID-based URLs)
  const isOwnProfile = authenticated && user && (
    user.id === actorId || 
    user.id === decodeURIComponent(identifier) ||
    user.username === actorId ||
    (user.username && user.username.startsWith('@') && user.username.slice(1) === actorId) ||
    (user.username && !user.username.startsWith('@') && user.username === actorId)
  )
  
  // Use useLayoutEffect to redirect BEFORE paint to prevent flash of old username
  // This runs synchronously before the browser paints, preventing any visual flash
  useLayoutEffect(() => {
    if (authenticated && user?.username && !isUsernameParam) {
      const decodedIdentifier = decodeURIComponent(identifier)
      const viewingOwnId = user.id === actorId || 
                          user.id === decodedIdentifier ||
                          user.id === identifier
      
      if (viewingOwnId && user.username) {
        // Additional null check to prevent redirecting to /profile/undefined
        const cleanUsername = user.username.startsWith('@') ? user.username.slice(1) : user.username
        // Only redirect if cleanUsername is valid and the current URL doesn't already match
        if (cleanUsername && identifier !== cleanUsername && decodedIdentifier !== cleanUsername && actorId !== cleanUsername) {
          // Use router.replace for client-side navigation (preserves React state)
          router.replace(`/profile/${cleanUsername}`)
        }
      }
    }
  }, [authenticated, user?.id, user?.username, actorId, identifier, isUsernameParam, router])

  // Enable error toast notifications
  useErrorToasts()
  
  // Load actor/user info
  const [actorInfo, setActorInfo] = useState<ProfileInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreatingDM, setIsCreatingDM] = useState(false)
  const [apiPosts, setApiPosts] = useState<Array<{
    id: string
    content: string
    author: string
    authorId: string
    timestamp: string
    authorName?: string
    authorUsername?: string | null
    authorProfileImageUrl?: string | null
    likeCount?: number
    commentCount?: number
    shareCount?: number
    isLiked?: boolean
    isShared?: boolean
  }>>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  
  const currentUserId = user?.id

  // Handle creating DM with user
  const handleMessageClick = async () => {
    if (!authenticated || !actorInfo?.id || isCreatingDM || !user?.id) return

    setIsCreatingDM(true)
    
    // Generate deterministic chat ID (same format as backend)
    // Sort IDs to ensure consistency
    const sortedIds = [user.id, actorInfo.id].sort()
    const chatId = `dm-${sortedIds.join('-')}`
    
    // Navigate directly to chat page
    // Chat will be created in DB when first message is sent
    router.push(`/chats?chat=${chatId}&newDM=${actorInfo.id}`)
    
    setIsCreatingDM(false)
  }

  const loadActorInfo = useCallback(async () => {
    setLoading(true)
    
    const token = await getAccessToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    // First, always try to load as a user by ID
    // This handles IDs like "testuser-53618432" or Privy IDs
    const userResponse = await fetch(`/api/users/${encodeURIComponent(actorId)}/profile`, { headers }).catch((error: Error) => {
      console.error('Error loading user by ID:', error)
      return null
    })
    
    if (userResponse?.ok) {
      const userData = await userResponse.json()
      if (userData.user) {
        const user = userData.user
        setActorInfo({
          id: user.id,
          name: user.displayName || user.username || 'User',
          description: user.bio || '',
          role: user.isActor ? 'Actor' : 'User',
          type: user.isActor ? 'actor' : 'user' as const,
          isUser: true,
          username: user.username,
          profileImageUrl: user.profileImageUrl,
          coverImageUrl: user.coverImageUrl,
          stats: user.stats,
        })
        
        // Redirect to username-based URL if username exists and we're not already on it
        if (user.username && !isUsernameParam && !isOwnProfile) {
          const cleanUsername = user.username.startsWith('@') ? user.username.slice(1) : user.username
          router.replace(`/profile/${cleanUsername}`)
          return
        }
        
        setLoading(false)
        return
      }
    }
      
    // If it's a username (starts with @) or looks like a username, try username lookup
    if (isUsernameParam || (!actorId.startsWith('did:privy:') && actorId.length <= 42 && !actorId.includes('-'))) {
      const usernameLookupResponse = await fetch(`/api/users/by-username/${encodeURIComponent(actorId)}`, { headers }).catch((error: Error) => {
        console.error('Error loading user by username:', error)
        return null
      })
      
      if (usernameLookupResponse?.ok) {
        const usernameData = await usernameLookupResponse.json()
        if (usernameData.user) {
          const user = usernameData.user
          setActorInfo({
            id: user.id,
            name: user.displayName || user.username || 'User',
            description: user.bio || '',
            role: user.isActor ? 'Actor' : 'User',
            type: user.isActor ? 'actor' : 'user' as const,
            isUser: true,
            username: user.username,
            profileImageUrl: user.profileImageUrl,
            coverImageUrl: user.coverImageUrl,
            stats: user.stats,
          })
          
          // Redirect to username-based URL if we're on ID-based URL
          if (!isUsernameParam && user.username && !isOwnProfile) {
            const cleanUsername = user.username.startsWith('@') ? user.username.slice(1) : user.username
            router.replace(`/profile/${cleanUsername}`)
            return
          }
          
          setLoading(false)
          return
        }
      }
    }
      
      // Try to load from actors.json (contains all actors)
      const response = await fetch('/data/actors.json')
      if (!response.ok) throw new Error('Failed to load actors')
      
      const actorsDb = await response.json() as { actors?: Actor[]; organizations?: Organization[] }
      
      // Find actor
      let actor = actorsDb.actors?.find((a) => a.id === actorId)
      if (!actor) {
        actor = actorsDb.actors?.find((a) => a.name === actorId)
      }
      if (actor) {
        // Find which game this actor belongs to
        let gameId: string | null = null
        for (const game of allGames) {
          const allActors = [
            ...(game.setup?.mainActors || []),
            ...(game.setup?.supportingActors || []),
            ...(game.setup?.extras || []),
          ]
          if (allActors.some(a => a.id === actorId)) {
            gameId = game.id
            break
          }
        }
        
      // Fetch actor stats from database
      let stats = { followers: 0, following: 0, posts: 0 }
      const statsResponse = await fetch(`/api/actors/${encodeURIComponent(actor.id)}/stats`).catch((error: Error) => {
        console.error('Failed to load actor stats:', error)
        return null
      })
      
      if (statsResponse?.ok) {
        const statsData = await statsResponse.json()
        if (statsData.stats) {
          stats = {
            followers: statsData.stats.followers || 0,
            following: statsData.stats.following || 0,
            posts: statsData.stats.posts || 0,
          }
        }
      }
        
        setActorInfo({
          id: actor.id,
          name: actor.name,
          description: actor.description,
          profileDescription: actor.profileDescription,
          tier: actor.tier,
          domain: actor.domain,
          personality: actor.personality,
          affiliations: actor.affiliations,
          role: actor.role || actor.tier || 'Actor',
          type: 'actor' as const,
          game: gameId ? { id: gameId } : undefined,
          username: ('username' in actor ? actor.username as string : actor.id) as string | undefined, // Use username if available, fallback to ID
          stats,
        })
        setLoading(false)
        return
      }
      
      // Find organization
      let org = actorsDb.organizations?.find((o) => o.id === actorId)
      if (!org) {
        org = actorsDb.organizations?.find((o) => o.name === actorId)
      }
      if (org) {
      // Fetch organization stats from database (orgs are also stored as actors)
      let stats = { followers: 0, following: 0, posts: 0 }
      const statsResponse = await fetch(`/api/actors/${encodeURIComponent(org.id)}/stats`).catch((error: Error) => {
        console.error('Failed to load organization stats:', error)
        return null
      })
      
      if (statsResponse?.ok) {
        const statsData = await statsResponse.json()
        if (statsData.stats) {
          stats = {
            followers: statsData.stats.followers || 0,
            following: statsData.stats.following || 0,
            posts: statsData.stats.posts || 0,
          }
        }
      }
        
        setActorInfo({
          id: org.id,
          name: org.name,
          description: org.description,
          profileDescription: org.profileDescription,
          type: 'organization' as const,
          role: 'Organization',
          stats,
        })
        setLoading(false)
        return
      }
      
      // Not found
      setActorInfo(null)
      setLoading(false)
  }, [actorId, allGames, authenticated, currentUserId, identifier, isOwnProfile, isUsernameParam, router, getAccessToken])

  useEffect(() => {
    loadActorInfo()
  }, [loadActorInfo])
  
  // Listen for profile updates (when user follows/unfollows someone)
  useEffect(() => {
    const handleProfileUpdate = () => {
      // Reset optimistic count to trigger refetch from server
      setTimeout(() => {
        setOptimisticFollowerCount(null)
        // Refetch actor info to get updated counts
        loadActorInfo()
      }, 1000) // Small delay to allow backend cache invalidation
    }
    
    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('profile-updated', handleProfileUpdate)
  }, [loadActorInfo])
  
  // Reset optimistic count when actorInfo changes (server data arrived)
  useEffect(() => {
    if (actorInfo && optimisticFollowerCount !== null) {
      // Wait a bit then reset to use server value
      const timer = setTimeout(() => {
        setOptimisticFollowerCount(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [actorInfo, optimisticFollowerCount])

  useEffect(() => {
    const loadPosts = async () => {
      if (!actorId) return
      
      setLoadingPosts(true)
      // If we have actorInfo with ID, use that; otherwise use actorId (could be username)
      const searchId = actorInfo?.id || actorId
      // Fetch posts from API by authorId
      const response = await fetch(`/api/posts?actorId=${encodeURIComponent(searchId)}&limit=100`)
      if (response.ok) {
        const data = await response.json()
        if (data.posts && Array.isArray(data.posts)) {
          setApiPosts(data.posts)
        }
      }
      setLoadingPosts(false)
    }

    // Load posts when actorInfo is available (has the correct ID)
    if (actorInfo?.id) {
      loadPosts()
    }
  }, [actorId, actorInfo?.id])

  // Get posts for this actor from all games
  const gameStorePosts = useMemo(() => {
    const posts: Array<{
      post: FeedPost
      gameId: string
      gameName: string
      timestampMs: number
    }> = []

    allGames.forEach(game => {
      game.timeline?.forEach(day => {
        day.feedPosts?.forEach(post => {
          if (post.author === actorId) {
            const postDate = new Date(post.timestamp)
            posts.push({
              post,
              gameId: game.id,
              gameName: game.id,
              timestampMs: postDate.getTime()
            })
          }
        })
      })
    })

    // Sort by timestamp (newest first)
    return posts.sort((a, b) => b.timestampMs - a.timestampMs)
  }, [allGames, actorId])

  // Combine API posts and game store posts, removing duplicates
  const actorPosts = useMemo(() => {
    const combined: Array<{
      post: FeedPost
      gameId: string
      gameName: string
      timestampMs: number
    }> = []

    // Add API posts first
    apiPosts.forEach(apiPost => {
      combined.push({
        post: {
          id: apiPost.id,
          day: 0,
          content: apiPost.content,
          author: apiPost.authorId,
          authorName: apiPost.authorName || actorInfo?.name || apiPost.authorId,
          authorUsername: apiPost.authorUsername || actorInfo?.username || null,
          authorProfileImageUrl: apiPost.authorProfileImageUrl || actorInfo?.profileImageUrl || null,
          timestamp: apiPost.timestamp,
          type: POST_TYPES.POST, // User-generated posts
          sentiment: 0, // Neutral sentiment for user posts
          clueStrength: 0, // User posts don't have clue strength
          pointsToward: null, // User posts don't hint at yes/no
          likeCount: apiPost.likeCount,
          commentCount: apiPost.commentCount,
          shareCount: apiPost.shareCount,
          isLiked: apiPost.isLiked,
          isShared: apiPost.isShared,
        },
        gameId: '',
        gameName: '',
        timestampMs: new Date(apiPost.timestamp).getTime()
      })
    })

    // Add game store posts that aren't already in API posts
    const apiPostIds = new Set(apiPosts.map(p => p.id))
    gameStorePosts.forEach(gamePost => {
      if (!apiPostIds.has(gamePost.post.id)) {
        combined.push({
          ...gamePost,
          post: {
            ...gamePost.post,
            authorProfileImageUrl: gamePost.post.authorProfileImageUrl || actorInfo?.profileImageUrl || null,
          },
        })
      }
    })

    // Sort by timestamp (newest first)
    return combined.sort((a, b) => b.timestampMs - a.timestampMs)
  }, [apiPosts, gameStorePosts, actorInfo])

  // Separate posts and replies
  const originalPosts = useMemo(() => {
    return actorPosts.filter(item => !item.post.replyTo)
  }, [actorPosts])

  const replyPosts = useMemo(() => {
    return actorPosts.filter(item => item.post.replyTo)
  }, [actorPosts])

  // Filter by tab
  const tabFilteredPosts = useMemo(() => {
    return tab === 'posts' ? originalPosts : replyPosts
  }, [tab, originalPosts, replyPosts])

  // Filter by search query
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredPosts

    const query = searchQuery.toLowerCase()
    return tabFilteredPosts.filter(item =>
      item.post.content?.toLowerCase().includes(query)
    )
  }, [tabFilteredPosts, searchQuery])

  // Loading or actor not found
  if (loading) {
    // If we're redirecting, don't show loading state
    if (isOwnProfile && user?.username && !isUsernameParam) {
      return null
    }
    
    return (
      <PageContainer noPadding className="min-h-screen">
        <div className="w-full max-w-[700px] mx-auto">
          <ProfileHeaderSkeleton />
          <div className="border-t border-border/5 mt-4">
            <FeedSkeleton count={5} />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!actorInfo) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="sticky top-0 z-10 bg-background">
          <div className="px-4 py-3 flex items-center gap-4">
            <Link
              href="/feed"
              className="hover:bg-muted/50 rounded-full p-2 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Profile Not Found</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">User or Actor &quot;{actorId}&quot; not found</p>
          <Link
            href="/feed"
            className="px-6 py-3 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Back to Feed
          </Link>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop: Content + Widget layout */}
      <div className="hidden xl:flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
            <div className="px-4 py-3 flex items-center gap-4">
              <Link
                href="/feed"
                className="hover:bg-muted/50 rounded-full p-2 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex-1">
                <h1 className="text-xl font-bold">{actorInfo.name}</h1>
                <p className="text-sm text-muted-foreground">{actorInfo.stats?.posts || actorPosts.length} posts</p>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <div className="border-b border-border">
          {/* Cover Image */}
          <div className="relative h-[200px] bg-muted">
            {(() => {
              // Get banner URL using the utility function (supports CDN)
              const bannerUrl = actorInfo.isUser && actorInfo.type === 'user' && 'coverImageUrl' in actorInfo
                ? actorInfo.coverImageUrl as string
                : getBannerImageUrl(
                    null,
                    actorInfo.id,
                    actorInfo.type === 'organization' ? 'organization' : 'actor'
                  )

              return bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt={`${actorInfo.name} banner`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to gradient if image not found
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null
            })()}
            <div className={cn(
              "w-full h-full bg-gradient-to-br from-primary/20 to-primary/5",
              actorInfo.type === 'actor' || actorInfo.type === 'organization' ? "hidden" : ""
            )} />
          </div>

          {/* Profile Info Container */}
          <div className="px-4 pb-4">
            {/* Top Row: Avatar + Action Buttons */}
            <div className="flex justify-between items-start mb-4">
              {/* Profile Picture - Overlapping cover */}
              <div className="relative -mt-16 sm:-mt-20">
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-background bg-background overflow-hidden">
                  <Avatar
                    id={actorInfo.id}
                    name={(actorInfo.name ?? actorInfo.username ?? '') as string}
                    type={
                      actorInfo.type === 'organization'
                        ? 'business'
                        : actorInfo.isUser || actorInfo.type === 'user'
                          ? 'user'
                          : (actorInfo.type as 'actor' | undefined)
                    }
                    src={actorInfo.profileImageUrl || undefined}
                    size="lg"
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3">
                {authenticated && user && user.id !== actorInfo.id && (
                  <>
                    {/* Only show message button for users, not actors/NPCs */}
                    {actorInfo.isUser && actorInfo.type === 'user' && (
                      <button 
                        onClick={handleMessageClick}
                        disabled={isCreatingDM}
                        className="p-2 rounded-full border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Send message"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                    <FollowButton
                      userId={actorInfo.id}
                      size="md"
                      variant="button"
                      onFollowerCountChange={(delta) => {
                        // Optimistically update the follower count based on current displayed value
                        setOptimisticFollowerCount(prev => {
                          const currentCount = prev !== null ? prev : (actorInfo.stats?.followers || 0)
                          return Math.max(0, currentCount + delta) // Never go negative
                        })
                      }}
                    />
                  </>
                )}
                {isOwnProfile && (
                  <Link
                    href="/settings"
                    className="px-4 py-2 rounded-full font-bold border border-border hover:bg-muted/50 transition-colors"
                  >
                    Edit profile
                  </Link>
                )}
              </div>
            </div>

            {/* Name and Handle */}
            <div className="mb-3">
              <div className="flex items-center gap-1 mb-0.5">
                <h2 className="text-xl font-bold">{actorInfo.name ?? actorInfo.username ?? ''}</h2>
                {actorInfo.type === 'actor' && !actorInfo.isUser && (
                  <VerifiedBadge size="md" />
                )}
                {actorInfo.type === 'user' && (
                  <OnChainBadge 
                    isRegistered={actorInfo.onChainRegistered ?? false}
                    nftTokenId={actorInfo.nftTokenId ?? null}
                    size="md"
                  />
                )}
              </div>
              {actorInfo.username && (
                <p className="text-muted-foreground text-[15px]">@{actorInfo.username}</p>
              )}
            </div>

            {/* Description/Bio */}
            {(actorInfo.profileDescription || actorInfo.description) && (
              <p className="text-foreground text-[15px] mb-3 whitespace-pre-wrap">
                {actorInfo.profileDescription || actorInfo.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-4 text-[15px]">
              <Link href="#" className="hover:underline">
                <span className="font-bold text-foreground">{actorInfo.stats?.following || 0}</span>
                <span className="text-muted-foreground ml-1">Following</span>
              </Link>
              <Link href="#" className="hover:underline">
                <span className="font-bold text-foreground">
                  {optimisticFollowerCount !== null ? optimisticFollowerCount : (actorInfo.stats?.followers || 0)}
                </span>
                <span className="text-muted-foreground ml-1">Followers</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs: Posts vs Replies vs Trades */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Tab Buttons */}
            <div className="flex items-center flex-1">
              <button
                onClick={() => setTab('posts')}
                className={cn(
                  'px-4 h-full font-semibold transition-all duration-300 relative hover:bg-muted/30',
                  tab === 'posts'
                    ? 'text-foreground opacity-100'
                    : 'text-foreground opacity-50'
                )}
              >
                Posts
              </button>
              <button
                onClick={() => setTab('replies')}
                className={cn(
                  'px-4 h-full font-semibold transition-all duration-300 relative hover:bg-muted/30',
                  tab === 'replies'
                    ? 'text-foreground opacity-100'
                    : 'text-foreground opacity-50'
                )}
              >
                Replies
              </button>
              <button
                onClick={() => setTab('trades')}
                className={cn(
                  'px-4 h-full font-semibold transition-all duration-300 relative hover:bg-muted/30',
                  tab === 'trades'
                    ? 'text-foreground opacity-100'
                    : 'text-foreground opacity-50'
                )}
              >
                Trades
              </button>
            </div>

            {/* Search Bar - Top Right (hide on trades tab) */}
            {tab !== 'trades' && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${tab}...`}
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-muted border-0 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Posts/Replies/Trades */}
        <div className="px-4">
          {tab === 'trades' ? (
            <TradesFeed userId={actorInfo?.id} />
          ) : loadingPosts ? (
            <div className="w-full">
              <FeedSkeleton count={5} />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No posts found matching your search' : 'No posts yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredPosts.map((item, i) => {
                const postData = {
                  id: item.post.id,
                  type: item.post.type,
                  content: item.post.content,
                  fullContent: item.post.fullContent || null,
                  articleTitle: item.post.articleTitle || null,
                  byline: item.post.byline || null,
                  biasScore: item.post.biasScore ?? null,
                  category: item.post.category || null,
                  authorId: item.post.author,
                  authorName: item.post.authorName,
                  authorUsername: item.post.authorUsername || null,
                  authorProfileImageUrl: item.post.authorProfileImageUrl || null,
                  timestamp: item.post.timestamp,
                  likeCount: item.post.likeCount,
                  commentCount: item.post.commentCount,
                  shareCount: item.post.shareCount,
                  isLiked: item.post.isLiked,
                  isShared: item.post.isShared,
                  // Repost metadata
                  isRepost: item.post.isRepost || false,
                  originalPostId: item.post.originalPostId || null,
                  originalAuthorId: item.post.originalAuthorId || null,
                  originalAuthorName: item.post.originalAuthorName || null,
                  originalAuthorUsername: item.post.originalAuthorUsername || null,
                  originalAuthorProfileImageUrl: item.post.originalAuthorProfileImageUrl || null,
                  originalContent: item.post.originalContent || null,
                  quoteComment: item.post.quoteComment || null,
                };
                
                return postData.type && postData.type === 'article' ? (
                  <ArticleCard
                    key={`${item.post.id}-${i}`}
                    post={postData}
                    onClick={() => router.push(`/post/${item.post.id}`)}
                  />
                ) : (
                  <PostCard
                    key={`${item.post.id}-${i}`}
                    post={postData}
                    onClick={() => router.push(`/post/${item.post.id}`)}
                    showInteractions={true}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
        </div>

        {/* Widget Sidebar - Show for all user profiles */}
        {actorInfo && actorInfo.isUser && (
          <div className="hidden xl:flex flex-col w-96 flex-shrink-0 overflow-y-auto bg-sidebar p-4">
            <ProfileWidget userId={actorInfo.id} />
          </div>
        )}
      </div>

      {/* Mobile/Tablet: Full width content */}
      <div className="flex xl:hidden flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <div className="px-4 py-3 flex items-center gap-4">
            <Link
              href="/feed"
              className="hover:bg-muted/50 rounded-full p-2 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{actorInfo.name}</h1>
              <p className="text-sm text-muted-foreground">{actorInfo.stats?.posts || actorPosts.length} posts</p>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile Header */}
          <div className="border-b border-border">
            {/* Cover Image */}
            <div className="relative h-[200px] bg-muted">
              {(() => {
                // Get banner URL using the utility function (supports CDN)
                const bannerUrl = actorInfo.isUser && actorInfo.type === 'user' && 'coverImageUrl' in actorInfo
                  ? actorInfo.coverImageUrl as string
                  : getBannerImageUrl(
                      null,
                      actorInfo.id,
                      actorInfo.type === 'organization' ? 'organization' : 'actor'
                    )

                return bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt={`${actorInfo.name} banner`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to gradient if image not found
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null
              })()}
              <div className={cn(
                "w-full h-full bg-gradient-to-br from-primary/20 to-primary/5",
                actorInfo.type === 'actor' || actorInfo.type === 'organization' ? "hidden" : ""
              )} />
            </div>

            {/* Profile Info Container */}
            <div className="px-4 pb-4">
              {/* Top Row: Avatar + Action Buttons */}
              <div className="flex justify-between items-start mb-4">
                {/* Profile Picture - Overlapping cover */}
                <div className="relative -mt-16 sm:-mt-20">
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-background bg-background overflow-hidden">
                    <Avatar
                      id={actorInfo.id}
                      name={(actorInfo.name ?? actorInfo.username ?? '') as string}
                      type={
                        actorInfo.type === 'organization'
                          ? 'business'
                          : actorInfo.isUser || actorInfo.type === 'user'
                            ? 'user'
                            : (actorInfo.type as 'actor' | undefined)
                      }
                      src={actorInfo.profileImageUrl || undefined}
                      size="lg"
                      className="w-full h-full"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3">
                  {authenticated && user && user.id !== actorInfo.id && (
                    <>
                      {/* Only show message button for users, not actors/NPCs */}
                      {actorInfo.isUser && actorInfo.type === 'user' && (
                        <button 
                          onClick={handleMessageClick}
                          disabled={isCreatingDM}
                          className="p-2 rounded-full border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Send message"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </button>
                      )}
                      <FollowButton
                        userId={actorInfo.id}
                        size="md"
                        variant="button"
                        onFollowerCountChange={(delta) => {
                          // Optimistically update the follower count based on current displayed value
                          setOptimisticFollowerCount(prev => {
                            const currentCount = prev !== null ? prev : (actorInfo.stats?.followers || 0)
                            return Math.max(0, currentCount + delta) // Never go negative
                          })
                        }}
                      />
                    </>
                  )}
                  {isOwnProfile && (
                    <Link
                      href="/settings"
                      className="px-4 py-2 rounded-full font-bold border border-border hover:bg-muted/50 transition-colors"
                    >
                      Edit profile
                    </Link>
                  )}
                </div>
              </div>

              {/* Name and Handle */}
              <div className="mb-3">
                <div className="flex items-center gap-1 mb-0.5">
                  <h2 className="text-xl font-bold">{actorInfo.name ?? actorInfo.username ?? ''}</h2>
                  {actorInfo.type === 'actor' && !actorInfo.isUser && (
                    <VerifiedBadge size="md" />
                  )}
                </div>
                {actorInfo.username && (
                  <p className="text-muted-foreground text-[15px]">@{actorInfo.username}</p>
                )}
              </div>

              {/* Description/Bio */}
              {(actorInfo.profileDescription || actorInfo.description) && (
                <p className="text-foreground text-[15px] mb-3 whitespace-pre-wrap">
                  {actorInfo.profileDescription || actorInfo.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex gap-4 text-[15px]">
                <Link href="#" className="hover:underline">
                  <span className="font-bold text-foreground">{actorInfo.stats?.following || 0}</span>
                  <span className="text-muted-foreground ml-1">Following</span>
                </Link>
                <Link href="#" className="hover:underline">
                  <span className="font-bold text-foreground">
                    {optimisticFollowerCount !== null ? optimisticFollowerCount : (actorInfo.stats?.followers || 0)}
                  </span>
                  <span className="text-muted-foreground ml-1">Followers</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Tabs: Posts vs Replies */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4">
              {/* Tab Buttons */}
              <div className="flex items-center flex-1">
                <button
                  onClick={() => setTab('posts')}
                  className={cn(
                    'px-4 h-14 font-semibold transition-all duration-300 relative hover:bg-muted/30',
                    tab === 'posts'
                      ? 'text-foreground opacity-100'
                      : 'text-foreground opacity-50'
                  )}
                >
                  Posts
                </button>
                <button
                  onClick={() => setTab('replies')}
                  className={cn(
                    'px-4 h-14 font-semibold transition-all duration-300 relative hover:bg-muted/30',
                    tab === 'replies'
                      ? 'text-foreground opacity-100'
                      : 'text-foreground opacity-50'
                  )}
                >
                  Replies
                </button>
              </div>

              {/* Search Bar - Top Right (hidden on small screens) */}
              <div className="relative w-full sm:w-64 py-2 sm:py-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${tab}...`}
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-muted border-0 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="px-4">
            {loadingPosts ? (
              <div className="w-full">
                <FeedSkeleton count={4} />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No posts found matching your search' : 'No posts yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredPosts.map((item, i) => {
                  const postData = {
                    id: item.post.id,
                    type: item.post.type,
                    content: item.post.content,
                    fullContent: item.post.fullContent || null,
                    articleTitle: item.post.articleTitle || null,
                    byline: item.post.byline || null,
                    biasScore: item.post.biasScore ?? null,
                    category: item.post.category || null,
                    authorId: item.post.author,
                    authorName: item.post.authorName,
                    authorUsername: item.post.authorUsername || null,
                    authorProfileImageUrl: item.post.authorProfileImageUrl || null,
                    timestamp: item.post.timestamp,
                    likeCount: item.post.likeCount,
                    commentCount: item.post.commentCount,
                    shareCount: item.post.shareCount,
                    isLiked: item.post.isLiked,
                    isShared: item.post.isShared,
                    // Repost metadata
                    isRepost: item.post.isRepost || false,
                    originalPostId: item.post.originalPostId || null,
                    originalAuthorId: item.post.originalAuthorId || null,
                    originalAuthorName: item.post.originalAuthorName || null,
                    originalAuthorUsername: item.post.originalAuthorUsername || null,
                    originalAuthorProfileImageUrl: item.post.originalAuthorProfileImageUrl || null,
                    originalContent: item.post.originalContent || null,
                    quoteComment: item.post.quoteComment || null,
                  };
                  
                  return postData.type && postData.type === 'article' ? (
                    <ArticleCard
                      key={`${item.post.id}-${i}`}
                      post={postData}
                      onClick={() => router.push(`/post/${item.post.id}`)}
                    />
                  ) : (
                    <PostCard
                      key={`${item.post.id}-${i}`}
                      post={postData}
                      onClick={() => router.push(`/post/${item.post.id}`)}
                      showInteractions={true}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
