import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const socialApiUrl = process.env.SOCIAL_API_URL || 'http://waf-social-api:8081'
    
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie')
    
    const response = await fetch(`${socialApiUrl}/session/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader })
      }
    })
    
    const data = await response.text()
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Session me proxy error:', error)
    // Return unauthorized for connection errors (service not available)
    if (error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED') {
      return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}