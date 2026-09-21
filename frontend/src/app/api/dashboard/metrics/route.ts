import { NextRequest } from 'next/server'
import { proxyJson } from '@/lib/server/proxy'

export async function GET(request: NextRequest) {
  return proxyJson(request, 'dashboard', '/api/dashboard/metrics')
}
