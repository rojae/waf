import { NextRequest, NextResponse } from 'next/server'
import { ENV, HTTP_STATUS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie')
    
    const response = await fetch(`${ENV.DASHBOARD_API_URL}/api/alerts/recent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader })
      }
    })
    
    const data = await response.json()
    
    return NextResponse.json(data, {
      status: response.status
    })
  } catch (error) {
    console.error('Alerts proxy error:', error)
    // Return service unavailable for connection errors
    if (error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED') {
      return NextResponse.json({ error: 'service_unavailable' }, { status: HTTP_STATUS.SERVICE_UNAVAILABLE })
    }
    return NextResponse.json({ error: 'internal_error' }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR })
  }
}