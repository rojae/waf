import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const redirectUri = searchParams.get('redirect_uri')

  // Get the actual request origin from headers (for ngrok)
  const host = request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const origin = request.headers.get('origin')

  // Use origin if available, otherwise construct from host
  const currentOrigin = origin || `${forwardedProto || 'https'}://${host}`
  const callbackUrl = `${currentOrigin}/login/oauth2/code/google`

  // Google OAuth parameters
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  if (!clientId) {
    return Response.json({ error: 'Google Client ID not configured' }, { status: 500 })
  }
  const scope = 'openid profile email'
  const state = Math.random().toString(36).substring(2, 15)

  // Store redirect URI in state for later use
  const stateData = JSON.stringify({
    random: state,
    redirect_uri: redirectUri || `${currentOrigin}/dashboard`
  })

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code&` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${encodeURIComponent(btoa(stateData))}&` +
    `redirect_uri=${callbackUrl}`

  return Response.redirect(googleAuthUrl)
}