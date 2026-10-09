import { NextRequest } from 'next/server'
import { handleGoogleCallback } from '@/lib/server/oauth'

export async function GET(request: NextRequest) {
  return handleGoogleCallback(request)
}

