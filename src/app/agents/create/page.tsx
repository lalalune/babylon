'use client'

import { PageContainer } from '@/components/shared/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { ArrowLeft, Bot, Camera, ChevronLeft, ChevronRight, Coins, Edit2, Loader2, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'

const STORAGE_KEY = 'babylon_agent_draft'
const TOTAL_PROFILE_PICTURES = 100

type AgentTemplate = {
  archetype: string
  name: string
  description: string
  bio: string
  system: string
  personality: string
  tradingStrategy: string
}

type ProfileFormData = {
  username: string
  displayName: string
  bio: string
  profileImageUrl: string
  coverImageUrl: string
}

type EditModalState = {
  isOpen: boolean
  formData: ProfileFormData
  profileImage: { file: File | null; preview: string | null }
  coverImage: { file: File | null; preview: string | null }
  error: string | null
}

export default function CreateAgentPage() {
  const router = useRouter()
  const { user, authenticated, ready, getAccessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [generatingField, setGeneratingField] = useState<string | null>(null)

  // Profile state (Babylon profile fields) - single source of truth
  const [profileData, setProfileData] = useState<ProfileFormData>({
    username: '',
    displayName: '',
    bio: '',
    profileImageUrl: '',
    coverImageUrl: '',
  })

  // Agent configuration state
  const [agentData, setAgentData] = useState({
    system: '',
    personality: '',
    tradingStrategy: '',
    initialDeposit: 100,
  })
  
  // Edit profile modal state
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    formData: {
      username: '',
      displayName: '',
      bio: '',
      profileImageUrl: '',
      coverImageUrl: '',
    },
    profileImage: { file: null, preview: null },
    coverImage: { file: null, preview: null },
    error: null,
  })
  
  const profileImageInputRef = useRef<HTMLInputElement>(null)
  const bannerImageInputRef = useRef<HTMLInputElement>(null)

  // Helper to extract index from image URL
  const getImageIndex = (url: string, type: 'profile' | 'banner'): number => {
    const match = url.match(new RegExp(`${type === 'profile' ? 'profile' : 'banner'}-(\\d+)\\.jpg`))
    return match ? parseInt(match[1]!, 10) : 1
  }

  // Helper to get current image URLs (for display)
  const getCurrentProfileImage = (): string => {
    if (editModal.isOpen && editModal.profileImage.preview) {
      return editModal.profileImage.preview
    }
    return profileData.profileImageUrl || `/assets/user-profiles/profile-1.jpg`
  }

  const getCurrentBanner = (): string => {
    if (editModal.isOpen && editModal.coverImage.preview) {
      return editModal.coverImage.preview
    }
    return profileData.coverImageUrl || `/assets/user-banners/banner-1.jpg`
  }

  // Load template and initialize
  useEffect(() => {
    const loadTemplate = async () => {
      const savedData = localStorage.getItem(STORAGE_KEY)
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          // Only load saved data if it has all required fields
          if (parsed.profileData && parsed.profileData.displayName && parsed.profileData.username) {
            setProfileData(parsed.profileData)
          }
          if (parsed.agentData && parsed.agentData.system) {
            setAgentData(parsed.agentData)
          }
          // If profile data is incomplete, continue to load template
          if (parsed.profileData && parsed.profileData.displayName && parsed.profileData.username) {
            setIsInitialized(true)
            return
          }
        } catch (error) {
          console.error('Failed to parse saved data:', error)
          localStorage.removeItem(STORAGE_KEY)
        }
      }

      // Load template index
      try {
        const indexResponse = await fetch('/agent-templates/index.json')
        if (!indexResponse.ok) throw new Error('Failed to load template index')
        
        const index = await indexResponse.json() as { templates: string[] }
        if (!index.templates || index.templates.length === 0) {
          throw new Error('No templates available')
        }
        
        const randomTemplate = index.templates[Math.floor(Math.random() * index.templates.length)]!
        
        // Load template
        const templateResponse = await fetch(`/agent-templates/${randomTemplate}.json`)
        if (!templateResponse.ok) throw new Error('Failed to load template')
        
        const template = await templateResponse.json() as AgentTemplate
        
        // Generate agent name
        const agentName = generateAgentName()
        
        // Replace placeholders
        const processedTemplate = {
          ...template,
          name: template.name.replace('{{agentName}}', agentName),
          system: template.system.replace(/{{agentName}}/g, agentName),
          personality: template.personality.replace(/{{agentName}}/g, agentName),
          tradingStrategy: template.tradingStrategy.replace(/{{agentName}}/g, agentName),
        }
        
        // Set random images
        const randomPfp = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
        const randomBanner = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
        
        // Initialize form data
        setProfileData({
          username: agentName.toLowerCase().replace(/\s+/g, ''),
          displayName: processedTemplate.name,
          bio: processedTemplate.description,
          profileImageUrl: `/assets/user-profiles/profile-${randomPfp}.jpg`,
          coverImageUrl: `/assets/user-banners/banner-${randomBanner}.jpg`,
        })
        
        setAgentData({
          system: processedTemplate.system,
          personality: processedTemplate.bio, // Use bio template for personality (will be split into array)
          tradingStrategy: processedTemplate.tradingStrategy,
          initialDeposit: 100,
        })
        
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to load template:', error)
        toast.error('Failed to load agent template. Using defaults.')
        
        // Fallback to defaults
        const agentName = generateAgentName()
        const randomPfp = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
        const randomBanner = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
        
        setProfileData({
          username: agentName.toLowerCase().replace(/\s+/g, ''),
          displayName: agentName,
          bio: 'An AI trading agent',
          profileImageUrl: `/assets/user-profiles/profile-${randomPfp}.jpg`,
          coverImageUrl: `/assets/user-banners/banner-${randomBanner}.jpg`,
        })
        
        setAgentData({
          system: 'You are an AI trading agent.',
          personality: '',
          tradingStrategy: '',
          initialDeposit: 100,
        })
        
        setIsInitialized(true)
      }
    }
    
    loadTemplate()
  }, [])

  // Save to localStorage
  useEffect(() => {
    if (!isInitialized) return
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profileData,
        agentData,
      }))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }, [profileData, agentData, isInitialized])

  const generateAgentName = () => {
    const prefixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Sigma', 'Zeta', 'Nova', 'Quantum', 'Neo']
    const suffixes = ['Trader', 'Bot', 'Agent', 'AI', 'Pro', 'Mind', 'Core', 'Node', 'Edge', 'Prime']
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`
  }

  const updateAgentField = (field: string, value: string | number) => {
    setAgentData(prev => ({ ...prev, [field]: value }))
  }

  const cycleProfilePicture = (direction: 'next' | 'prev') => {
    const currentUrl = editModal.isOpen 
      ? (editModal.profileImage.preview || profileData.profileImageUrl)
      : profileData.profileImageUrl
    
    const currentIndex = getImageIndex(currentUrl, 'profile')
    const newIndex = direction === 'next'
      ? (currentIndex >= TOTAL_PROFILE_PICTURES ? 1 : currentIndex + 1)
      : (currentIndex <= 1 ? TOTAL_PROFILE_PICTURES : currentIndex - 1)
    
    const newUrl = `/assets/user-profiles/profile-${newIndex}.jpg`
    
    if (editModal.isOpen) {
      setEditModal(prev => ({
        ...prev,
        profileImage: { file: null, preview: newUrl }
      }))
    } else {
      setProfileData(prev => ({ ...prev, profileImageUrl: newUrl }))
    }
  }

  const cycleBanner = (direction: 'next' | 'prev') => {
    const currentUrl = editModal.isOpen
      ? (editModal.coverImage.preview || profileData.coverImageUrl)
      : profileData.coverImageUrl
    
    const currentIndex = getImageIndex(currentUrl, 'banner')
    const newIndex = direction === 'next'
      ? (currentIndex >= TOTAL_PROFILE_PICTURES ? 1 : currentIndex + 1)
      : (currentIndex <= 1 ? TOTAL_PROFILE_PICTURES : currentIndex - 1)
    
    const newUrl = `/assets/user-banners/banner-${newIndex}.jpg`
    
    if (editModal.isOpen) {
      setEditModal(prev => ({
        ...prev,
        coverImage: { file: null, preview: newUrl }
      }))
    } else {
      setProfileData(prev => ({ ...prev, coverImageUrl: newUrl }))
    }
  }

  const handleProfileImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setEditModal(prev => ({ ...prev, error: 'Please select a valid image file' }))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setEditModal(prev => ({ ...prev, error: 'File size must be less than 10MB' }))
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditModal(prev => ({
        ...prev,
        profileImage: { file, preview: reader.result as string },
        error: null,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setEditModal(prev => ({ ...prev, error: 'Please select a valid image file' }))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setEditModal(prev => ({ ...prev, error: 'File size must be less than 10MB' }))
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditModal(prev => ({
        ...prev,
        coverImage: { file, preview: reader.result as string },
        error: null,
      }))
    }
    reader.readAsDataURL(file)
  }

  const openEditModal = () => {
    setEditModal({
      isOpen: true,
      formData: { ...profileData },
      profileImage: { file: null, preview: profileData.profileImageUrl },
      coverImage: { file: null, preview: profileData.coverImageUrl },
      error: null,
    })
  }

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      formData: {
        username: '',
        displayName: '',
        bio: '',
        profileImageUrl: '',
        coverImageUrl: '',
      },
      profileImage: { file: null, preview: null },
      coverImage: { file: null, preview: null },
      error: null,
    })
    if (profileImageInputRef.current) profileImageInputRef.current.value = ''
    if (bannerImageInputRef.current) bannerImageInputRef.current.value = ''
  }

  const saveProfileModal = () => {
    // Update profile data with form data and image URLs
    setProfileData({
      ...editModal.formData,
      profileImageUrl: editModal.profileImage.preview || profileData.profileImageUrl,
      coverImageUrl: editModal.coverImage.preview || profileData.coverImageUrl,
    })
    
    closeEditModal()
    toast.success('Profile updated!')
  }

  const handleRegenerateField = async (field: string) => {
    setGeneratingField(field)
    
    try {
      const token = await getAccessToken()
      
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch('/api/agents/generate-field', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldName: field,
          currentValue: agentData[field as keyof typeof agentData],
          context: {
            name: profileData.displayName,
            description: profileData.bio,
            system: agentData.system,
            personality: agentData.personality,
            tradingStrategy: agentData.tradingStrategy,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate field')
      }

      const result = await response.json()
      
      // For personality, split by | and join with \n (no \n\n allowed)
      if (field === 'personality') {
        const personalityLines = result.value.split('|').map((s: string) => s.trim()).filter((s: string) => s)
        updateAgentField('personality', personalityLines.join('\n'))
      } else {
        // Replace \n\n with \n for other fields
        const cleaned = result.value.replace(/\n\n+/g, '\n')
        updateAgentField(field, cleaned)
      }

      toast.success(`Regenerated ${field}!`)
    } catch (error) {
      console.error('Error generating field:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate field')
    } finally {
      setGeneratingField(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    if (!profileData.displayName.trim()) {
      toast.error('Agent name is required')
      return
    }
    if (!agentData.system.trim()) {
      toast.error('System prompt is required')
      return
    }

    setLoading(true)
    
    try {
      const token = await getAccessToken()
      
      if (!token) {
        toast.error('Authentication required')
        return
      }
      
      // Split personality by \n and filter empty lines for bio array
      const bioArray = agentData.personality.split('\n').filter(b => b.trim())
      
      // Append trading strategy to system prompt
      const systemPrompt = agentData.tradingStrategy.trim()
        ? `${agentData.system}\n\nTrading Strategy: ${agentData.tradingStrategy}`
        : agentData.system
      
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: profileData.displayName,
          description: profileData.bio,
          profileImageUrl: profileData.profileImageUrl,
          coverImageUrl: profileData.coverImageUrl,
          system: systemPrompt,
          bio: bioArray,
          personality: agentData.personality,
          tradingStrategy: agentData.tradingStrategy,
          initialDeposit: agentData.initialDeposit,
        })
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        const errorMsg = error.error || 'Failed to create agent'
        toast.error(errorMsg)
        return
      }

      const data = await res.json() as { agent: { id: string } }
      
      // Clear draft
      localStorage.removeItem(STORAGE_KEY)
      
      toast.success('Agent created successfully!')
      router.push(`/agents/${data.agent.id}`)
    } catch (error) {
      console.error('Failed to create agent:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create agent')
    } finally {
      setLoading(false)
    }
  }

  if (!ready || !authenticated) {
    return (
      <PageContainer>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
            <Bot className="w-16 h-16 mb-4 text-[#0066FF]" />
            <h3 className="text-2xl font-bold mb-2">Create an Agent</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Please sign in to create an AI agent
            </p>
          </div>
        </div>
      </PageContainer>
    )
  }

  const totalPoints = user?.reputationPoints || 0

  if (!isInitialized) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <Loader2 className="w-16 h-16 mb-4 text-[#0066FF] animate-spin" />
          <h3 className="text-2xl font-bold mb-2">Loading Agent Template</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Preparing your agent...
          </p>
        </div>
      </PageContainer>
    )
  }

  const currentProfileImage = getCurrentProfileImage()
  const currentBanner = getCurrentBanner()

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto pb-24">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => router.push('/agents')}
            variant="ghost"
            className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8 text-[#0066FF]" />
            <h1 className="text-3xl font-bold">Create New Agent</h1>
          </div>
          <p className="text-muted-foreground">
            Create your AI agent with a unique personality and trading strategy
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Preview Card */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#0066FF]" />
                Agent Profile
              </h2>
              <Button
                type="button"
                onClick={openEditModal}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </Button>
            </div>

            <div className="rounded-lg border border-white/20 overflow-hidden bg-background/50">
              {/* Banner */}
              <div className="relative h-32 bg-muted">
                <Image
                  src={currentBanner}
                  alt="Banner"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Profile Info */}
              <div className="px-4 pb-4">
                {/* Profile Picture */}
                <div className="relative -mt-12 mb-4">
                  <div className="w-24 h-24 rounded-full border-4 border-background overflow-hidden">
                    <Image
                      src={currentProfileImage}
                      alt="Profile"
                      width={96}
                      height={96}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </div>

                {/* Name & Description */}
                <h3 className="text-xl font-bold mb-1">{profileData.displayName}</h3>
                <p className="text-sm text-muted-foreground mb-1">@{profileData.username}</p>
                {profileData.bio && (
                  <p className="text-sm text-muted-foreground mb-3">{profileData.bio}</p>
                )}
              </div>
            </div>
          </div>

          {/* Agent Configuration */}
          <div className="space-y-6 pt-2 border-t border-border">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#0066FF]" />
              Agent Configuration
            </h2>

            {/* Important Directions */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center justify-between">
                <span>Important Directions <span className="text-red-500">*</span></span>
                <button
                  type="button"
                  onClick={() => handleRegenerateField('system')}
                  disabled={generatingField === 'system'}
                  className="text-xs text-[#0066FF] hover:text-[#2952d9] flex items-center gap-1 disabled:opacity-50"
                >
                  {generatingField === 'system' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Regenerate
                    </>
                  )}
                </button>
              </label>
              <Textarea
                value={agentData.system}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  // Replace \n\n with \n
                  const cleaned = e.target.value.replace(/\n\n+/g, '\n')
                  updateAgentField('system', cleaned)
                }}
                placeholder="Important instructions for how your agent should behave..."
                rows={6}
                className="w-full border-white/20 focus:border-white/60 focus:ring-0 resize-none rounded-lg px-4 py-3 transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Defines how your agent thinks and behaves
              </p>
            </div>

            {/* Personality (maps to ElizaOS bio array) */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center justify-between">
                <span>Personality</span>
                <button
                  type="button"
                  onClick={() => handleRegenerateField('personality')}
                  disabled={generatingField === 'personality'}
                  className="text-xs text-[#0066FF] hover:text-[#2952d9] flex items-center gap-1 disabled:opacity-50"
                >
                  {generatingField === 'personality' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Regenerate
                    </>
                  )}
                </button>
              </label>
              <Textarea
                value={agentData.personality}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  // Replace \n\n with \n
                  const cleaned = e.target.value.replace(/\n\n+/g, '\n')
                  updateAgentField('personality', cleaned)
                }}
                placeholder="Describe the agent's personality, communication style, and temperament. e.g. Confident and assertive, but also friendly and approachable. Speaks in clear, concise language and isn't afraid to challenge assumptions."
                rows={4}
                className="w-full border-white/20 focus:border-white/60 focus:ring-0 resize-none rounded-lg px-4 py-3 transition-colors"
              />
            </div>

            {/* Trading Strategy */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center justify-between">
                <span>Trading Strategy</span>
                <button
                  type="button"
                  onClick={() => handleRegenerateField('tradingStrategy')}
                  disabled={generatingField === 'tradingStrategy'}
                  className="text-xs text-[#0066FF] hover:text-[#2952d9] flex items-center gap-1 disabled:opacity-50"
                >
                  {generatingField === 'tradingStrategy' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Regenerate
                    </>
                  )}
                </button>
              </label>
              <Textarea
                value={agentData.tradingStrategy}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  // Replace \n\n with \n
                  const cleaned = e.target.value.replace(/\n\n+/g, '\n')
                  updateAgentField('tradingStrategy', cleaned)
                }}
                placeholder="Describe trading approach..."
                rows={5}
                className="w-full border-white/20 focus:border-white/60 focus:ring-0 resize-none rounded-lg px-4 py-3 transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                This will be appended to the system prompt.
              </p>
            </div>
          </div>

          {/* Initial Deposit */}
          <div className="space-y-6 pt-2 border-t border-border">
            <div className="space-y-4">
              {/* Label and Input Row */}
              <div className="flex items-center gap-4">
                <label className="text-lg font-semibold flex items-center gap-2 flex-shrink-0">
                  <Coins className="w-5 h-5 text-[#0066FF]" />
                  Deposit Points to Agent
                </label>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    type="number"
                    value={agentData.initialDeposit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                      updateAgentField('initialDeposit', Math.max(0, value))
                    }}
                    min={0}
                    max={totalPoints}
                    placeholder="Enter amount"
                    className={cn(
                      'flex-1 border-white/20 focus:border-white/60 focus:ring-0 h-12 rounded-lg px-4 transition-colors text-lg font-medium',
                      '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                      (agentData.initialDeposit > totalPoints || agentData.initialDeposit < 0) && 'border-red-500/50 focus:border-red-500'
                    )}
                  />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {[0, 100, 1000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => updateAgentField('initialDeposit', Math.min(amount, totalPoints))}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          'border border-white/20 hover:border-[#0066FF]/50 hover:bg-[#0066FF]/10',
                          agentData.initialDeposit === amount && 'bg-[#0066FF]/20 border-[#0066FF] text-[#0066FF]',
                          amount > totalPoints && 'opacity-50 cursor-not-allowed'
                        )}
                        disabled={amount > totalPoints}
                      >
                        {amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Balance Info */}
              <p className="text-xs text-muted-foreground">
                Your balance: <span className="font-medium text-foreground">{totalPoints.toLocaleString()} pts</span>
              </p>

              {/* Error Messages */}
              {(agentData.initialDeposit > totalPoints || agentData.initialDeposit < 0) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-red-400">
                      {agentData.initialDeposit < 0 ? 'Invalid amount' : 'Insufficient balance'}
                    </p>
                    <p className="text-xs text-red-400/80 mt-0.5">
                      {agentData.initialDeposit < 0 
                        ? 'Amount must be 0 or greater'
                        : `You have ${totalPoints.toLocaleString()} points available`}
                    </p>
                  </div>
                </div>
              )}

              {/* Info Message */}
              <p className="text-xs text-muted-foreground">
                Your agent spends points for chat messages and autonomous trading decisions. You can add more points anytime.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t border-border">
            <Button
              type="submit"
              disabled={loading || agentData.initialDeposit > totalPoints}
              className={cn(
                'w-full flex items-center justify-center gap-2',
                'bg-[#0066FF] hover:bg-[#2952d9] text-primary-foreground',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'px-6 py-3 rounded-lg font-medium transition-all'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Agent...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Create Agent</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Edit Profile Modal */}
        {editModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:px-4 md:py-3">
            <div className="bg-background w-full h-full md:h-auto md:max-w-2xl md:rounded-xl md:max-h-[90vh] border-0 md:border md:border-border flex flex-col">
              {/* Header */}
              <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <button
                    onClick={closeEditModal}
                    className="p-2 hover:bg-muted active:bg-muted rounded-full transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg sm:text-xl font-bold truncate">Edit Profile</h2>
                </div>
                <button
                  onClick={saveProfileModal}
                  className="px-4 sm:px-6 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/90 font-semibold text-sm shrink-0 min-h-[44px]"
                >
                  Save
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {/* Banner Image Section */}
                <div className="relative h-32 sm:h-48 bg-muted">
                  {currentBanner && (
                    <Image
                      src={currentBanner}
                      alt="Banner"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <input
                      ref={bannerImageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleBannerUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cycleBanner('prev')}
                        className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-primary-foreground transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => bannerImageInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black/60 hover:bg-black/80 active:bg-black/80 rounded-full text-primary-foreground transition-colors min-h-[44px]"
                        aria-label="Change banner"
                      >
                        <Camera className="w-4 h-4 shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">Change banner</span>
                      </button>
                      <button
                        onClick={() => cycleBanner('next')}
                        className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-primary-foreground transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Profile Image Section */}
                <div className="px-4 -mt-12 sm:-mt-16 mb-6">
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                    <div className="w-full h-full rounded-full border-4 border-background overflow-hidden">
                      {currentProfileImage && (
                        <Image
                          src={currentProfileImage}
                          alt="Profile"
                          width={128}
                          height={128}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      )}
                    </div>
                    <input
                      ref={profileImageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleProfileImageUpload}
                      className="hidden"
                    />
                    {/* Mobile: Visible buttons */}
                    <div className="absolute -bottom-2 -right-2 flex items-center gap-1 sm:hidden">
                      <button
                        onClick={() => cycleProfilePicture('prev')}
                        className="p-1.5 bg-primary text-primary-foreground rounded-full border-2 border-background hover:bg-primary/90 transition-colors"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => profileImageInputRef.current?.click()}
                        className="p-2 bg-primary text-primary-foreground rounded-full border-2 border-background hover:bg-primary/90 transition-colors"
                        aria-label="Change profile picture"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => cycleProfilePicture('next')}
                        className="p-1.5 bg-primary text-primary-foreground rounded-full border-2 border-background hover:bg-primary/90 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Desktop: Hover overlay */}
                    <div className="hidden sm:flex absolute inset-0 items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity gap-1">
                      <button
                        onClick={() => cycleProfilePicture('prev')}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-primary-foreground transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => profileImageInputRef.current?.click()}
                        className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-primary-foreground transition-colors"
                        aria-label="Change profile picture"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => cycleProfilePicture('next')}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-primary-foreground transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="px-4 pb-6 space-y-5">
                  {/* Error Message */}
                  {editModal.error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                      <X className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{editModal.error}</span>
                    </div>
                  )}

                  {/* Display Name */}
                  <div>
                    <label htmlFor="edit-displayName" className="block text-sm font-medium text-muted-foreground mb-2">
                      Display Name
                    </label>
                    <input
                      id="edit-displayName"
                      type="text"
                      value={editModal.formData.displayName}
                      onChange={(e) => setEditModal(prev => ({
                        ...prev,
                        formData: { ...prev.formData, displayName: e.target.value }
                      }))}
                      placeholder="Agent name"
                      className="w-full bg-muted/50 border border-white/20 focus:border-white/60 rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-0 min-h-[44px] text-base transition-colors"
                      maxLength={50}
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label htmlFor="edit-username" className="block text-sm font-medium text-muted-foreground mb-2">
                      Username
                    </label>
                    <div className="flex items-center gap-2 bg-muted/50 border border-white/20 focus-within:border-white/60 rounded-lg px-4 py-3 min-h-[44px]">
                      <span className="text-muted-foreground shrink-0">@</span>
                      <input
                        id="edit-username"
                        type="text"
                        value={editModal.formData.username}
                        onChange={(e) => setEditModal(prev => ({
                          ...prev,
                          formData: { ...prev.formData, username: e.target.value }
                        }))}
                        placeholder="username"
                        className="flex-1 bg-transparent text-foreground focus:outline-none text-base min-w-0"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label htmlFor="edit-bio" className="block text-sm font-medium text-muted-foreground mb-2">
                      Description
                    </label>
                    <textarea
                      id="edit-bio"
                      value={editModal.formData.bio}
                      onChange={(e) => setEditModal(prev => ({
                        ...prev,
                        formData: { ...prev.formData, bio: e.target.value }
                      }))}
                      placeholder="Brief description of your agent..."
                      rows={3}
                      maxLength={200}
                      className="w-full bg-muted/50 border border-white/20 focus:border-white/60 rounded-lg px-4 py-3 text-foreground resize-none focus:outline-none focus:ring-0 text-base transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
