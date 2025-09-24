import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Forward all query parameters to the social-api
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const redirectUri = searchParams.get('redirect_uri')

  if (!code || !state) {
    return Response.json({ success: false, error: 'Missing code or state' }, { status: 400 })
  }

  try {
    // Call the social-api backend
    const socialApiUrl = process.env.SOCIAL_API_URL || 'http://waf-social-api.waf-system.svc.cluster.local:8081'
    const backendUrl = `${socialApiUrl}/auth/google/callback?code=${code}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri || '')}`

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend response: ${response.status}`)
    }

    const data = await response.json()
    return Response.json(data)

  } catch (error) {
    console.error('OAuth proxy error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}