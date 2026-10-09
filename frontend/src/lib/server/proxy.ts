import { NextRequest, NextResponse } from 'next/server'
import { ENV, HTTP_STATUS } from '@/lib/constants'

type UpstreamService = 'dashboard'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const HEADER_TIMEOUT_MS = 15000
const BODY_TIMEOUT_MS = 30000

type ProxyFetchResult = {
  response: Response
  cleanup: () => void
  abort: () => void
}

function upstreamBase(service: UpstreamService) {
  if (service === 'dashboard') return ENV.DASHBOARD_API_URL
  return ENV.DASHBOARD_API_URL
}

function isUnsafe(method: string) {
  return UNSAFE_METHODS.has(method.toUpperCase())
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return Boolean(origin && origin === request.nextUrl.origin)
}

function targetUrl(request: NextRequest, service: UpstreamService, path: string) {
  const url = new URL(path, upstreamBase(service))
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value)
  })
  return url
}

function forwardedHeaders(request: NextRequest, stream = false) {
  const headers = new Headers()
  const cookie = request.headers.get('cookie')
  const contentType = request.headers.get('content-type')
  const origin = request.headers.get('origin')

  if (cookie) headers.set('Cookie', cookie)
  if (contentType) headers.set('Content-Type', contentType)
  if (origin) headers.set('Origin', origin)
  headers.set('Accept', stream ? 'text/event-stream, application/json' : request.headers.get('accept') || 'application/json')
  if (stream) headers.set('Cache-Control', 'no-cache')

  return headers
}

async function requestBody(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  return request.text()
}

async function proxyFetch(request: NextRequest, service: UpstreamService, path: string, stream = false) {
  if (isUnsafe(request.method) && !sameOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: HTTP_STATUS.FORBIDDEN })
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), HEADER_TIMEOUT_MS)
  const cancel = () => abortController.abort()
  const cleanup = () => {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', cancel)
  }
  request.signal.addEventListener('abort', cancel, { once: true })

  try {
    const response = await fetch(targetUrl(request, service, path), {
      method: request.method,
      headers: forwardedHeaders(request, stream),
      body: await requestBody(request),
      redirect: 'manual',
      signal: abortController.signal,
    })
    clearTimeout(timeout)

    if (response.status >= 300 && response.status < 400) {
      cleanup()
      return NextResponse.json({ error: 'upstream_redirect_rejected' }, { status: HTTP_STATUS.BAD_GATEWAY })
    }

    return { response, cleanup, abort: () => abortController.abort() }
  } catch (error) {
    cleanup()
    const aborted = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? 'upstream_timeout' : 'upstream_unavailable' },
      { status: aborted ? HTTP_STATUS.REQUEST_TIMEOUT : HTTP_STATUS.SERVICE_UNAVAILABLE },
    )
  }
}

function emptyBodyStatus(status: number) {
  return status === 204 || status === 205 || status === 304
}

async function readBodyWithDeadline(result: ProxyFetchResult) {
  if (emptyBodyStatus(result.response.status)) return null

  const timeout = setTimeout(result.abort, BODY_TIMEOUT_MS)
  try {
    return await result.response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function streamWithCleanup(body: ReadableStream<Uint8Array>, cleanup: () => void, abort: () => void) {
  const reader = body.getReader()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          cleanup()
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (error) {
        cleanup()
        controller.error(error)
      }
    },
    async cancel(reason) {
      abort()
      cleanup()
      await reader.cancel(reason)
    },
  })
}

export async function proxyJson(request: NextRequest, service: UpstreamService, path: string) {
  const result = await proxyFetch(request, service, path)
  if (result instanceof NextResponse) return result

  const headers = new Headers()
  const contentType = result.response.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)

  try {
    return new NextResponse(await readBodyWithDeadline(result), {
      status: result.response.status,
      headers,
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? 'upstream_timeout' : 'upstream_unavailable' },
      { status: aborted ? HTTP_STATUS.REQUEST_TIMEOUT : HTTP_STATUS.SERVICE_UNAVAILABLE },
    )
  } finally {
    result.cleanup()
  }
}

export async function proxyEventStream(request: NextRequest, service: UpstreamService, path: string) {
  const result = await proxyFetch(request, service, path, true)
  if (result instanceof NextResponse) return result
  const { response, cleanup, abort } = result

  if (!response.ok || !response.body) {
    try {
      return new NextResponse(await readBodyWithDeadline(result), {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
      })
    } finally {
      cleanup()
    }
  }

  return new Response(streamWithCleanup(response.body, cleanup, abort), {
    status: response.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
