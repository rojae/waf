import { NextRequest } from 'next/server'
import { proxyJson } from '@/lib/server/proxy'

type Params = { params: Promise<{ path?: string[] }> }

async function handler(request: NextRequest, { params }: Params) {
  const { path = [] } = await params
  return proxyJson(request, 'dashboard', `/api/dashboard/logs/${path.join('/')}`.replace(/\/$/, ''))
}

export const GET = handler

