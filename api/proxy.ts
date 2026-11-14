const PROXY_PATH_PARAMETER = 'proxyPath'

export default {
  async fetch(request: Request): Promise<Response> {
    const backendBaseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, '')

    if (!backendBaseUrl) {
      return Response.json({ error: 'BACKEND_API_URL is not configured' }, { status: 500 })
    }

    const incomingUrl = new URL(request.url)
    const apiPath = incomingUrl.searchParams.get(PROXY_PATH_PARAMETER)

    if (!apiPath) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const destination = new URL(`${backendBaseUrl}/${apiPath}`)
    for (const [key, value] of incomingUrl.searchParams) {
      if (key !== PROXY_PATH_PARAMETER) destination.searchParams.append(key, value)
    }

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
  },
}
