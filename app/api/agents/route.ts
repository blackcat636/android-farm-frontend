import { NextRequest, NextResponse } from 'next/server';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Отримує список всіх агентів з KV
 */
async function listAllAgents() {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.warn('[api/agents] Cloudflare KV не налаштовано');
    return [];
  }

  try {
    // Отримуємо список всіх ключів з префіксом tunnel_url:
    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/keys?prefix=tunnel_url:`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      console.error(`[api/agents] Помилка отримання ключів: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const agents = [];

    // Для кожного ключа отримуємо значення
    for (const keyInfo of data.result || []) {
      const key = keyInfo.name;
      const agentId = key.replace('tunnel_url:', '');
      
      try {
        // Отримуємо URL
        const urlResponse = await fetch(
          `${CLOUDFLARE_API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
          {
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
            }
          }
        );

        if (urlResponse.ok) {
          const urlData = await urlResponse.text();
          let tunnelUrl = urlData;
          let updatedAt: string | null = null;
          
          try {
            const parsed = JSON.parse(urlData);
            tunnelUrl = parsed.url || urlData;
            updatedAt = parsed.updated_at || null;
          } catch (e) {
            // Якщо не JSON, використовуємо як є
          }

          agents.push({
            id: agentId,
            tunnelUrl: tunnelUrl,
            updated_at: updatedAt
          });
        }
      } catch (error) {
        console.error(`[api/agents] Помилка отримання URL для агента ${agentId}:`, error);
      }
    }

    return agents;
  } catch (error) {
    console.error('[api/agents] Помилка отримання списку агентів:', error);
    return [];
  }
}

/**
 * Отримує URL тунелю для конкретного агента
 */
async function getAgentTunnelUrl(agentId: string): Promise<string | null> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_KV_NAMESPACE_ID) {
    return null;
  }

  try {
    const key = `tunnel_url:${agentId}`;
    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.text();
    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      return parsed.url || data;
    } catch (e) {
      return data;
    }
  } catch (error) {
    console.error(`[api/agents] Помилка отримання URL для агента ${agentId}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agentId');

  // Якщо вказано конкретний agentId - повертаємо його URL
  if (agentId) {
    const tunnelUrl = await getAgentTunnelUrl(agentId);
    if (tunnelUrl) {
      return NextResponse.json({ ok: true, url: tunnelUrl });
    }
    return NextResponse.json({ ok: false, message: 'Agent not found' }, { status: 404 });
  }

  // Якщо agentId не вказано - повертаємо список всіх агентів
  const agents = await listAllAgents();
  return NextResponse.json({ ok: true, agents });
}

