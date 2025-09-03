import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAMES, COOKIE_CONFIG, ENV, HTTP_STATUS } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie')
    
    const response = await fetch(`${ENV.SOCIAL_API_URL}/session/logout`, {
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
    nextResponse.cookies.set(COOKIE_NAMES.WAF_AT, '', {
      expires: new Date(0),
      ...COOKIE_CONFIG.WAF_AT
    })
    
    return nextResponse
  } catch (error) {
    console.error('Session logout proxy error:', error)
    // Even if backend fails, still clear the cookie locally
    const errorResponse = error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED'
      ? NextResponse.json({ error: 'service_unavailable' }, { status: HTTP_STATUS.SERVICE_UNAVAILABLE })
      : NextResponse.json({ error: 'internal_error' }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR })
    
    // Delete WAF_AT cookie even on error
    errorResponse.cookies.set(COOKIE_NAMES.WAF_AT, '', {
      expires: new Date(0),
      ...COOKIE_CONFIG.WAF_AT
    })
    
    return errorResponse
  }
}