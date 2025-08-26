import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const dashboardApiUrl = process.env.DASHBOARD_API_URL || 'http://waf-dashboard-api:8082'
    
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie')
    
    const response = await fetch(`${dashboardApiUrl}/api/dashboard/metrics`, {
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
    console.error('Dashboard metrics proxy error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}