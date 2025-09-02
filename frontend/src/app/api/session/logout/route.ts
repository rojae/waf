import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const socialApiUrl = process.env.SOCIAL_API_URL || 'http://waf-social-api:8081'
    
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie')
    
    const response = await fetch(`${socialApiUrl}/session/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader })
      }
    })
    
    const data = await response.text()
    
    // Create response with cookie deletion
    const nextResponse = new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    // Delete WAF_AT cookie
    nextResponse.cookies.set('WAF_AT', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
    
    return nextResponse
  } catch (error) {
    console.error('Session logout proxy error:', error)
    // Even if backend fails, still clear the cookie locally
    const errorResponse = error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED'
      ? NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
      : NextResponse.json({ error: 'internal_error' }, { status: 500 })
    
    // Delete WAF_AT cookie even on error
    errorResponse.cookies.set('WAF_AT', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
    
    return errorResponse
  }
}