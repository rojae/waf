'use client'

import { useAuth } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function HomeComponent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOAuthCallback, setIsOAuthCallback] = useState(false)

  // Check if this is an OAuth callback
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (code && state) {
      setIsOAuthCallback(true)
      handleOAuthCallback(code, state)
    }
  }, [searchParams])

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      // Call backend callback API directly
      const socialApiUrl = process.env.NEXT_PUBLIC_SOCIAL_API_URL || 'http://localhost:8081'
      const callbackUrl = `${socialApiUrl}/auth/google/callback?code=${code}&state=${state}&redirect_uri=${encodeURIComponent(window.location.origin)}`

      const response = await fetch(callbackUrl, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('OAuth callback failed')
      }

      const data = await response.json()

      if (data.success && data.access_token) {
        // 현재 도메인에 쿠키 설정 - 간단하게!
        document.cookie = `${data.cookie_name}=${data.access_token}; path=/; max-age=${data.cookie_max_age}; samesite=lax`
        console.log('Cookie set for current domain')

        // Redirect to dashboard
        router.push('/dashboard')
      } else {
        console.error('OAuth failed:', data)
        throw new Error(`Authentication failed: ${JSON.stringify(data)}`)
      }
    } catch (error) {
      console.error('OAuth callback error:', error)
      // If it's an OAuth code expired/invalid error, show better message
      const errorMsg = error instanceof Error ? error.message : 'OAuth failed'
      router.push(`/auth/signin?error=${encodeURIComponent(errorMsg)}`)
    }
  }

  useEffect(() => {
    if (loading || isOAuthCallback) return // Still loading or handling OAuth

    if (!user) {
      router.push('/auth/signin')
    } else {
      router.push('/dashboard')
    }
  }, [user, loading, router, isOAuthCallback])

  if (loading || isOAuthCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">WAF Dashboard</CardTitle>
            <CardDescription className="text-center">
              {isOAuthCallback ? 'Authenticating...' : 'Loading...'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return null
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">WAF Dashboard</CardTitle>
            <CardDescription className="text-center">
              Loading...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <HomeComponent />
    </Suspense>
  )
}