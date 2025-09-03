import { NextRequest, NextResponse } from 'next/server'
import { ENV } from '@/lib/constants'
import { ApiErrorHandler } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    
    const response = await fetch(`${ENV.SOCIAL_API_URL}/session/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader })
      }
    })
    
    const data = await response.text()
    
    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Session me proxy error:', error)
    const { error: message, status } = ApiErrorHandler.createErrorResponse(
      error as Error,
      'internal_error'
    )
    return NextResponse.json({ error: message }, { status })
  }
}