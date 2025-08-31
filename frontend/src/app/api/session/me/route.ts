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
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}