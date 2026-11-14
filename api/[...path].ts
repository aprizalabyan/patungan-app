const API_PREFIX = '/api/v1'

export default async function handler(request: Request): Promise<Response> {
  const backendBaseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, '')

  if (!backendBaseUrl) {
    return Response.json({ error: 'BACKEND_API_URL is not configured' }, { status: 500 })
  }

  const incomingUrl = new URL(request.url)
  if (!incomingUrl.pathname.startsWith(`${API_PREFIX}/`)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const apiPath = incomingUrl.pathname.slice(API_PREFIX.length)
  const destination = new URL(`${backendBaseUrl}${apiPath}${incomingUrl.search}`)
  const headers = new Headers(request.headers)
  headers.delete('host')

  const response = await fetch(destination, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
