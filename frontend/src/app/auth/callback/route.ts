import { NextRequest } from 'next/server'
import { redirectToCanonicalCallback } from '@/lib/server/oauth'

export async function GET(request: NextRequest) {
  return redirectToCanonicalCallback(request)
}

