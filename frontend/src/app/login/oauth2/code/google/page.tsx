'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function GoogleOAuthCallbackComponent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')

      if (!code || !state) {
        setError('Authorization code or state not found')
        return
      }

      try {
        // Call backend callback API directly - use same origin to avoid CORS
        const socialApiUrl = window.location.origin
        const callbackUrl = `${socialApiUrl}/auth/google/callback?code=${code}&state=${state}&redirect_uri=${encodeURIComponent(window.location.origin)}`

        console.log('OAuth callback - socialApiUrl:', socialApiUrl)
        console.log('OAuth callback - callbackUrl:', callbackUrl)

        const response = await fetch(callbackUrl, {
          method: 'GET',
          credentials: 'include',
        })

        console.log('OAuth callback - response status:', response.status)
        console.log('OAuth callback - response ok:', response.ok)

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
        const errorMsg = error instanceof Error ? error.message : 'OAuth failed'
        setError(errorMsg)
      }
    }

    handleCallback()
  }, [searchParams, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authenticating...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  )
}

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    }>
      <GoogleOAuthCallbackComponent />
    </Suspense>
  )
}