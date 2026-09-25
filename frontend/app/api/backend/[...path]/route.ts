import { NextRequest, NextResponse } from 'next/server';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const backendUrl = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '');
  const target = `${backendUrl}/${path.join('/')}${new URL(request.url).search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.set('X-API-Key', process.env.NEXT_PRIVATE_FRONTEND_API_KEY || '');

  const body = request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS'
    ? undefined
    : await request.arrayBuffer();

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
