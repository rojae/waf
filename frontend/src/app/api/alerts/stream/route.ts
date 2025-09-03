import { NextRequest } from 'next/server'
import { ENV, HTTP_STATUS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    // Create a new request to the backend
    const url = new URL(`${ENV.DASHBOARD_API_URL}/api/alerts/stream`)
    const searchParams = request.nextUrl.searchParams
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    // Return the stream directly to the client
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error proxying alerts stream:', error)
    // Return service unavailable for connection errors
    const status = (error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED') 
      ? HTTP_STATUS.SERVICE_UNAVAILABLE 
      : HTTP_STATUS.INTERNAL_SERVER_ERROR
    const message = status === HTTP_STATUS.SERVICE_UNAVAILABLE ? 'Service unavailable' : 'Failed to connect to alerts stream'
    
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}