import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function loadTsModule(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText
  const cjsModule = { exports: {} }
  const context = {
    module: cjsModule,
    exports: cjsModule.exports,
    require(specifier) {
      if (specifier in stubs) return stubs[specifier]
      throw new Error(`Unexpected require: ${specifier}`)
    },
    Response,
    Headers,
    AbortController,
    URL,
    console,
    fetch: (...args) => globalThis.fetch(...args),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    EventSource: stubs.EventSource,
  }
  vm.runInNewContext(transpiled, context, { filename })
  return cjsModule.exports
}

function constantsStub() {
  return {
    ENV: {
      DASHBOARD_API_URL: 'http://dashboard.internal',
      SOCIAL_API_URL: 'http://social.internal',
    },
    HTTP_STATUS: {
      FORBIDDEN: 403,
      METHOD_NOT_ALLOWED: 405,
      REQUEST_TIMEOUT: 408,
      BAD_GATEWAY: 502,
      NOT_FOUND: 404,
      NOT_IMPLEMENTED: 501,
      SERVICE_UNAVAILABLE: 503,
    },
    COOKIE_NAMES: {
      WAF_AT: 'WAF_AT',
      WAF_OAUTH_STATE: 'WAF_OAUTH_STATE',
    },
    COOKIE_CONFIG: {
      WAF_AT: { path: '/', httpOnly: true, secure: false, sameSite: 'lax' },
      WAF_OAUTH_STATE: { path: '/', httpOnly: true, secure: false, sameSite: 'lax', maxAge: 300 },
    },
  }
}

class MockNextResponse extends Response {
  constructor(body, init) {
    super(body, init)
    this.cookies = {
      set: (name, value, options = {}) => {
        const parts = [`${name}=${value}`]
        if (options.httpOnly) parts.push('HttpOnly')
        if (options.secure) parts.push('Secure')
        if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
        if (options.path) parts.push(`Path=${options.path}`)
        if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
        this.headers.append('Set-Cookie', parts.join('; '))
      },
    }
  }

  static json(body, init) {
    return new MockNextResponse(JSON.stringify(body), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  }

  static redirect(url, status = 307) {
    return new MockNextResponse(null, {
      status,
      headers: { Location: url.toString() },
    })
  }
}

function request(url, { method = 'GET', headers = {}, cookie = undefined } = {}) {
  const parsed = new URL(url)
  const requestHeaders = new Headers(headers)
  if (cookie) requestHeaders.set('cookie', cookie)
  return {
    method,
    nextUrl: parsed,
    headers: requestHeaders,
    cookies: {
      get(name) {
        if (!cookie) return undefined
        const found = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))
        return found ? { value: found.slice(name.length + 1) } : undefined
      },
    },
    signal: new AbortController().signal,
    async text() {
      return ''
    },
  }
}

test('custom rule mutations no longer fake success after failures', () => {
  const sources = [
    'src/components/custom-rules/CreateRuleModal.tsx',
    'src/components/custom-rules/EditRuleModal.tsx',
    'src/app/dashboard/custom-rules/page.tsx',
  ].map(read).join('\n')

  assert.doesNotMatch(sources, /simulat/i)
  assert.doesNotMatch(sources, /Fallback to demo|Update locally since backend is not available/)
  assert.match(sources, /not yet applied to nginx/)
})

test('rule and whitelist toggles send explicit enabled values', () => {
  const api = read('src/lib/api.ts')

  assert.match(api, /toggleRule<T = unknown>\(id: string, enabled: boolean\)/)
  assert.match(api, /toggleWhitelistEntry<T = unknown>\(id: string, enabled: boolean\)/)
  assert.match(api, /JSON\.stringify\(\{ enabled \}\)/)
})

test('realtime log connection attaches handlers for EventSource events and uses cookies', () => {
  const { createRealtimeLogConnection } = loadTsModule('src/hooks/useRealtimeLogs.ts', {
    react: { useState() {}, useEffect() {}, useRef() {} },
  })
  const listeners = {}
  let initSeen
  const eventSource = {
    readyState: 1,
    addEventListener(type, listener) {
      listeners[type] = listener
    },
    close() {},
  }

  const opened = []
  const errors = []
  const connection = createRealtimeLogConnection({
    createEventSource(url, init) {
      assert.equal(url, '/api/realtime/logs/stream')
      initSeen = init
      return eventSource
    },
    onOpen: () => opened.push(true),
    onLog: () => {},
    onConnection: () => {},
    onError: readyState => errors.push(readyState),
  })

  assert.equal(initSeen.withCredentials, true)
  assert.equal(typeof listeners.log, 'function')
  assert.equal(typeof listeners.connection, 'function')
  connection.onopen()
  connection.onerror()
  assert.deepEqual(opened, [true])
  assert.deepEqual(errors, [1])
})

test('SSE proxy forwards auth cookies and preserves upstream 401', async () => {
  const calls = []
  const { proxyEventStream } = loadTsModule('src/lib/server/proxy.ts', {
    'next/server': { NextResponse: MockNextResponse },
    '@/lib/constants': constantsStub(),
  })
  globalThis.fetch = async (url, init) => {
    calls.push({ url: url.toString(), init })
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const response = await proxyEventStream(
    request('http://app.local/api/realtime/logs/stream', { cookie: 'WAF_AT=token' }),
    'dashboard',
    '/api/realtime/logs/stream',
  )

  assert.equal(response.status, 401)
  assert.equal(calls[0].init.headers.get('Cookie'), 'WAF_AT=token')
})

test('alerts stream route uses the shared authenticated SSE proxy', () => {
  const source = read('src/app/api/alerts/stream/route.ts')

  assert.match(source, /proxyEventStream\(request, 'dashboard', '\/api\/alerts\/stream'\)/)
  assert.doesNotMatch(source, /Access-Control-Allow-Origin/)
  assert.doesNotMatch(source, /ENV\.DASHBOARD_API_URL/)
})

test('ApiClient treats 204 and empty successful bodies as successful void responses', async () => {
  const { ApiClient } = loadTsModule('src/lib/api.ts')
  const client = new ApiClient()
  const calls = []

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return new Response(null, { status: 204, statusText: 'No Content' })
  }

  await assert.doesNotReject(() => client.deleteRule('42'))
  assert.equal(calls[0].url, '/api/rules/42')
  assert.equal(calls[0].init.method, 'DELETE')

  globalThis.fetch = async () => new Response('', {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.doesNotReject(() => client.deleteWhitelistEntry('7'))
})

test('JSON proxy returns null body for upstream 204', async () => {
  const { proxyJson } = loadTsModule('src/lib/server/proxy.ts', {
    'next/server': { NextResponse: MockNextResponse },
    '@/lib/constants': constantsStub(),
  })
  globalThis.fetch = async () => new Response(null, { status: 204 })

  const response = await proxyJson(
    request('http://app.local/api/rules/1', {
      method: 'DELETE',
      headers: { origin: 'http://app.local' },
      cookie: 'WAF_AT=token',
    }),
    'dashboard',
    '/api/rules/1',
  )

  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
})

test('whitelist page presents whitelist records as stored drafts only', () => {
  const source = read('src/app/dashboard/whitelist/page.tsx')

  assert.match(source, /Whitelist Drafts/)
  assert.match(source, /Draft enabled/)
  assert.match(source, /Draft disabled/)
  assert.match(source, /not applied to nginx/)
  assert.doesNotMatch(source, /bypass WAF filtering/)
  assert.doesNotMatch(source, />Active</)
})

test('legacy custom-rules path redirects to canonical dashboard route without demo data', () => {
  const source = read('src/app/custom-rules/page.tsx')

  assert.match(source, /redirect\('\/dashboard\/custom-rules'\)/)
  assert.doesNotMatch(source, /SQL Injection Protection|XSS Protection|useState/)
})

test('OAuth callback rejects state mismatch without setting WAF_AT', async () => {
  const { handleGoogleCallback } = loadTsModule('src/lib/server/oauth.ts', {
    'next/server': { NextResponse: MockNextResponse },
    '@/lib/constants': constantsStub(),
  })
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response('{}')
  }

  const response = await handleGoogleCallback(
    request('http://app.local/login/oauth2/code/google?code=c&state=actual', {
      cookie: 'WAF_OAUTH_STATE=expected',
    }),
  )

  assert.equal(response.status, 307)
  assert.equal(new URL(response.headers.get('location')).pathname, '/auth/signin')
  assert.equal(fetchCalled, false)
  assert.doesNotMatch(response.headers.get('set-cookie') || '', /WAF_AT=/)
})

test('OAuth login copies only WAF_OAUTH_STATE onto the app origin', async () => {
  const { startGoogleLogin } = loadTsModule('src/lib/server/oauth.ts', {
    'next/server': { NextResponse: MockNextResponse },
    '@/lib/constants': constantsStub(),
  })
  globalThis.fetch = async () => new Response(null, {
    status: 302,
    headers: {
      Location: 'https://accounts.google.com/o/oauth2/v2/auth?state=backend-state',
      'Set-Cookie': 'WAF_OAUTH_STATE=backend-state; Path=/; HttpOnly, OTHER=value; Path=/',
    },
  })

  const response = await startGoogleLogin(request('http://app.local/api/auth/google/login'))
  const setCookie = response.headers.get('set-cookie') || ''

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://accounts.google.com/o/oauth2/v2/auth?state=backend-state')
  assert.match(setCookie, /WAF_OAUTH_STATE=backend-state/)
  assert.doesNotMatch(setCookie, /OTHER=value/)
  assert.match(setCookie, /Max-Age=300/)
})

test('OAuth callback rejects invalid backend payload without setting WAF_AT', async () => {
  const { handleGoogleCallback } = loadTsModule('src/lib/server/oauth.ts', {
    'next/server': { NextResponse: MockNextResponse },
    '@/lib/constants': constantsStub(),
  })
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const response = await handleGoogleCallback(
    request('http://app.local/login/oauth2/code/google?code=c&state=expected', {
      cookie: 'WAF_OAUTH_STATE=expected',
    }),
  )

  assert.equal(new URL(response.headers.get('location')).pathname, '/auth/signin')
  assert.doesNotMatch(response.headers.get('set-cookie') || '', /WAF_AT=/)
})
