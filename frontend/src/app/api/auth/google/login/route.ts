import { NextRequest } from 'next/server'
import { startGoogleLogin } from '@/lib/server/oauth'

export async function GET(request: NextRequest) {
  return startGoogleLogin(request)
}
