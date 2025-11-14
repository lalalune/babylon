/**
 * API Route: /api/og/pnl/[userId]
 * Generates OG image for P&L sharing
 */

import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/database-service'
import { calculatePortfolioPnL } from '@/lib/portfolio/calculate-pnl'

// Use Node.js runtime for full Prisma support
export const runtime = 'nodejs'

// Cache for 1 hour, revalidate in background
export const revalidate = 3600

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params
  
  const [user, pnlData] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        displayName: true,
        profileImageUrl: true,
      },
    }),
    calculatePortfolioPnL(userId)
  ])
  
  const displayName = user?.displayName || user?.username || 'Babylon User'
  const totalPnL = pnlData?.totalPnL || 0
  const accountEquity = pnlData?.accountEquity || 0
  const availableBalance = pnlData?.availableBalance || 0
  const pnlSign = totalPnL >= 0 ? '+' : ''
  const pnlColor = totalPnL >= 0 ? '#10B981' : '#EF4444'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0B1C3D 0%, #1a2942 100%)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            fontSize: 32,
            fontWeight: 'bold',
            color: 'white',
            display: 'flex',
          }}
        >
          Babylon
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 60,
          }}
        >
          {user?.profileImageUrl && (
            <img
              src={user.profileImageUrl}
              alt={displayName}
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                border: '4px solid rgba(255, 255, 255, 0.1)',
                marginBottom: 20,
              }}
            />
          )}
          <div
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 8,
              display: 'flex',
            }}
          >
            {displayName}
          </div>
          {user?.username && (
            <div
              style={{
                fontSize: 24,
                color: 'rgba(255, 255, 255, 0.6)',
                display: 'flex',
              }}
            >
              @{user.username}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            width: '80%',
            maxWidth: 800,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 40,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: 12,
                display: 'flex',
              }}
            >
              Total P&L
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: pnlColor,
                display: 'flex',
              }}
            >
              {pnlSign}${Math.abs(totalPnL).toFixed(2)}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 24,
              width: '100%',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 30,
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: 8,
                  display: 'flex',
                }}
              >
                Total Points
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 'bold',
                  color: 'white',
                  display: 'flex',
                }}
              >
                ${accountEquity.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 30,
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: 8,
                  display: 'flex',
                }}
              >
                Available
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 'bold',
                  color: 'white',
                  display: 'flex',
                }}
              >
                ${availableBalance.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            fontSize: 20,
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          Trading narratives, sharing the upside
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}

