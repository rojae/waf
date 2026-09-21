import { NextRequest, NextResponse } from 'next/server'
import { HTTP_STATUS } from '@/lib/constants'
import { proxyJson } from '@/lib/server/proxy'

type Params = { params: Promise<{ path?: string[] }> }

async function handler(request: NextRequest, { params }: Params) {
  const { path = [] } = await params
  const joinedPath = path.join('/')

  if (joinedPath === 'deploy') {
    return NextResponse.json(
      {
        error: 'deployment_unavailable',
        message: 'Rule deployment is intentionally unavailable until real nginx validation and reload are wired.',
      },
      { status: HTTP_STATUS.NOT_IMPLEMENTED },
    )
  }

  if (joinedPath === 'deployment-status') {
    return NextResponse.json({ error: 'deployment_status_unavailable' }, { status: HTTP_STATUS.NOT_FOUND })
  }

  const upstreamPath = `/api/rules/${joinedPath}`.replace(/\/$/, '')
  return proxyJson(request, 'dashboard', upstreamPath)
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
