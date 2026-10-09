import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_CONFIG, COOKIE_NAMES, ENV, HTTP_STATUS } from '@/lib/constants'

type AuthCallbackResponse = {
  success: boolean
  access_token?: string
  redirect_url?: string
  cookie_name?: string
  cookie_max_age?: number
}

function defaultRedirect(request: NextRequest) {
  return new URL('/dashboard', request.nextUrl.origin).toString()
}

function clearStateCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(COOKIE_NAMES.WAF_OAUTH_STATE, '', {
    ...COOKIE_CONFIG.WAF_OAUTH_STATE,
    secure: request.nextUrl.protocol === 'https:',
    expires: new Date(0),
    maxAge: 0,
  })
}

function signinRedirect(request: NextRequest, message: string, clearState = false) {
  const url = new URL('/auth/signin', request.nextUrl.origin)
  url.searchParams.set('error', message)
  const response = NextResponse.redirect(url)
  if (clearState) clearStateCookie(response, request)
  return response
}

function extractState(location: string | null) {
  if (!location) return null
  try {
    return new URL(location).searchParams.get('state')
  } catch {
    return null
  }
}

function upstreamStateCookie(response: Response) {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const values = getSetCookie ? getSetCookie.call(response.headers) : [response.headers.get('set-cookie')].filter(Boolean) as string[]
  const stateCookie = values.find(value => value.trim().startsWith(`${COOKIE_NAMES.WAF_OAUTH_STATE}=`))
  return stateCookie?.split(';', 1)[0].split('=', 2)[1] || null
}

function safeLocalRedirect(request: NextRequest, redirectUrl?: string) {
  if (!redirectUrl) return new URL('/dashboard', request.nextUrl.origin)

  try {
    const parsed = new URL(redirectUrl, request.nextUrl.origin)
    if (parsed.origin === request.nextUrl.origin) return parsed
  } catch {
    return new URL('/dashboard', request.nextUrl.origin)
  }

  return new URL('/dashboard', request.nextUrl.origin)
}

export async function startGoogleLogin(request: NextRequest) {
  const redirectUri = request.nextUrl.searchParams.get('redirect_uri') || defaultRedirect(request)
  const upstream = new URL('/auth/google/login', ENV.SOCIAL_API_URL)
  upstream.searchParams.set('redirect_uri', redirectUri)

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 15000)

  let response: Response
  try {
    response = await fetch(upstream, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'text/html,application/json' },
      signal: abortController.signal,
    })
  } catch {
    return NextResponse.json({ error: 'oauth_login_failed' }, { status: HTTP_STATUS.SERVICE_UNAVAILABLE })
  } finally {
    clearTimeout(timeout)
  }

  const location = response.headers.get('location')
  if (response.status < 300 || response.status >= 400 || !location) {
    return NextResponse.json({ error: 'oauth_login_failed' }, { status: HTTP_STATUS.BAD_GATEWAY })
  }

  const nextResponse = NextResponse.redirect(location, 302)
  const stateFromCookie = upstreamStateCookie(response)
  const stateFromRedirect = extractState(location)
  if (!stateFromCookie || !stateFromRedirect || decodeURIComponent(stateFromCookie) !== stateFromRedirect) {
    return NextResponse.json({ error: 'oauth_state_cookie_missing' }, { status: HTTP_STATUS.BAD_GATEWAY })
  }

  nextResponse.cookies.set(COOKIE_NAMES.WAF_OAUTH_STATE, decodeURIComponent(stateFromCookie), {
    ...COOKIE_CONFIG.WAF_OAUTH_STATE,
    secure: request.nextUrl.protocol === 'https:',
  })
  return nextResponse
}

export async function handleGoogleCallback(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get(COOKIE_NAMES.WAF_OAUTH_STATE)?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return signinRedirect(request, 'Invalid OAuth state', true)
  }

  const upstream = new URL('/auth/google/callback', ENV.SOCIAL_API_URL)
  upstream.searchParams.set('code', code)
  upstream.searchParams.set('state', state)
  upstream.searchParams.set('redirect_uri', defaultRedirect(request))

  try {
    const response = await fetch(upstream, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        Cookie: `${COOKIE_NAMES.WAF_OAUTH_STATE}=${encodeURIComponent(expectedState)}`,
      },
    })

    if (response.status >= 300 && response.status < 400) {
      return signinRedirect(request, 'OAuth backend redirect rejected', true)
    }

    const payload = await response.json().catch(() => null) as AuthCallbackResponse | null
    const accessToken = payload?.access_token
    const cookieName = payload?.cookie_name || COOKIE_NAMES.WAF_AT

    if (!response.ok || !payload?.success || !accessToken || cookieName !== COOKIE_NAMES.WAF_AT) {
      return signinRedirect(request, 'OAuth callback failed', true)
    }

    const nextResponse = NextResponse.redirect(safeLocalRedirect(request, payload.redirect_url))
    nextResponse.cookies.set(COOKIE_NAMES.WAF_AT, accessToken, {
      ...COOKIE_CONFIG.WAF_AT,
      secure: request.nextUrl.protocol === 'https:',
      maxAge: payload.cookie_max_age || 900,
    })
    clearStateCookie(nextResponse, request)
    return nextResponse
  } catch {
    return signinRedirect(request, 'OAuth callback failed', true)
  }
}

export function redirectToCanonicalCallback(request: NextRequest) {
  const target = new URL('/login/oauth2/code/google', request.nextUrl.origin)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (code) target.searchParams.set('code', code)
  if (state) target.searchParams.set('state', state)
  return NextResponse.redirect(target)
}
