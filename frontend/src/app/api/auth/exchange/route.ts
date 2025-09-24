import { NextRequest } from 'next/server'
import { ENV } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json()

    if (!code || !redirect_uri) {
      return Response.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Call backend to exchange authorization code for JWT
    const response = await fetch(`${ENV.SOCIAL_API_URL}/auth/google/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri,
      }),
    })

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`)
    }

    const data = await response.json()

    if (data.access_token) {
      // Create response and set JWT cookie
      const apiResponse = Response.json({ success: true })

      // Set JWT cookie with same configuration as backend
      apiResponse.headers.set(
        'Set-Cookie',
        `WAF_AT=${data.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900; Domain=${request.nextUrl.hostname}`
      )

      return apiResponse
    } else {
      return Response.json(
        { success: false, error: data.error || 'Token exchange failed' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Token exchange error:', error)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}