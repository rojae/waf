import { NextRequest } from 'next/server'
import { proxyEventStream } from '@/lib/server/proxy'

export async function GET(request: NextRequest) {
  return proxyEventStream(request, 'dashboard', '/api/alerts/stream')
}
