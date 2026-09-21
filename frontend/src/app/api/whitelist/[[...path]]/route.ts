import { NextRequest } from 'next/server'
import { proxyJson } from '@/lib/server/proxy'

type Params = { params: Promise<{ path?: string[] }> }

async function handler(request: NextRequest, { params }: Params) {
  const { path = [] } = await params
  const upstreamPath = `/api/whitelist/${path.join('/')}`.replace(/\/$/, '')
  return proxyJson(request, 'dashboard', upstreamPath)
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

