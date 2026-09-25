import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../../config/index.js';
import { AiProviderError } from '../errors/index.js';

/**
 * Trusted external academic discovery — a faithful Node port of the reference
 * (EDUNation) trust layer. Three hard rules are preserved verbatim:
 *  1. Only domains in the trust REGISTRY (or any public .edu/.gov host) may be
 *     used as evidence; everything else scores below the threshold.
 *  2. SSRF guard: http(s) only, no userinfo, no localhost/private/reserved
 *     addresses — validated before AND after every redirect hop.
 *  3. Honest degradation: no TAVILY key or no trusted result produces an
 *     explicit "unavailable" state, never a fabricated answer source.
 */

// domain -> [authorityCategory, trustScore] (port of reference REGISTRY).
export const TRUST_REGISTRY = {
  'docs.python.org': ['official_documentation', 0.99],
  'developer.mozilla.org': ['official_documentation', 0.97],
  'pytorch.org': ['official_documentation', 0.99],
  'tensorflow.org': ['official_documentation', 0.99],
  'w3.org': ['standards', 0.99],
  'ietf.org': ['standards', 0.99],
  'rfc-editor.org': ['standards', 0.99],
  'mit.edu': ['university', 0.96],
  'stanford.edu': ['university', 0.96],
  'berkeley.edu': ['university', 0.96],
  'cmu.edu': ['university', 0.96],
  'harvard.edu': ['university', 0.96],
  'ox.ac.uk': ['university', 0.96],
  'cam.ac.uk': ['university', 0.96],
  'acm.org': ['professional_research', 0.96],
  'ieee.org': ['professional_research', 0.96],
  'nature.com': ['peer_reviewed', 0.94],
  'science.org': ['peer_reviewed', 0.94],
  'arxiv.org': ['research_preprint', 0.84],
  'nasa.gov': ['government_science', 0.97],
  'nist.gov': ['government_science', 0.98],
  'ibm.com': ['recognized_technical_org', 0.86],
  'quantum.cloud.ibm.com': ['official_documentation', 0.96],
};

// Always-acceptable authorities even when not in the planned categories
// (mirrors the reference category filter).
const ALWAYS_ALLOWED_AUTHORITIES = new Set([
  'government',
  'government_science',
  'recognized_technical_org',
  'peer_reviewed',
  'research_preprint',
]);

export function trustOf(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return ['unverified', 0.25];
  }
  const host = (parsed.hostname ?? '').toLowerCase().replace(/^www\./, '');
  for (const [domain, pair] of Object.entries(TRUST_REGISTRY)) {
    if (host === domain || host.endsWith(`.${domain}`)) return pair;
  }
  if (host.endsWith('.edu')) return ['university', 0.91];
  if (host.endsWith('.gov')) return ['government', 0.93];
  return ['unverified', 0.25];
}

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const v6 = ip.toLowerCase();
    return (
      v6 === '::1' ||
      v6.startsWith('fc') ||
      v6.startsWith('fd') ||
      v6.startsWith('fe80') ||
      v6 === '::'
    );
  }
  const parts = ip.split('.').map((p) => Number(p));
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0 ||
    (a >= 224 && a <= 255)
  );
}

async function isPublicHost(hostname) {
  if (!hostname || hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return false;
  }
  if (net.isIP(hostname)) {
    return !isPrivateIp(hostname);
  }
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every((record) => !isPrivateIp(record.address));
  } catch {
    return false;
  }
}

export async function validatePublicUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  return isPublicHost(parsed.hostname);
}

// --- HTML → plain text (port of the reference _TextExtractor / clean_html) ---

export function cleanHtml(rawHtml) {
  const withoutSkipped = String(rawHtml)
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, '\n');
  const withoutTags = withoutSkipped.replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return decoded.replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const FETCH_MAX_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

/** Safe public-network fetch with per-hop SSRF revalidation. */
export async function safeFetchText(url) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!(await validatePublicUrl(current))) {
      throw new AiProviderError('Rejected unsafe or non-public URL');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'AcademicLearningBot/1.0' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const next = new URL(response.headers.get('location'), current).toString();
      if (!(await validatePublicUrl(next))) {
        throw new AiProviderError('Redirected to unsafe URL');
      }
      current = next;
      continue;
    }
    if (!response.ok) {
      throw new AiProviderError(`External source returned status ${response.status}`);
    }
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > FETCH_MAX_BYTES) {
      throw new AiProviderError('External source exceeds safe download limit');
    }
    if (contentType.includes('text/html') || contentType === '') {
      return { url: current, text: cleanHtml(buffer.toString('utf8')), contentType: 'text/html' };
    }
    if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      return { url: current, text: buffer.toString('utf8'), contentType };
    }
    throw new AiProviderError(`Unsupported external MIME type: ${contentType}`);
  }
  throw new AiProviderError('External source exceeded redirect limit');
}

/**
 * Source-strategy planning (port of SourceStrategyPlanner): try an LLM JSON
 * plan first, fall back to the reference keyword heuristics.
 */
export async function planSourceStrategy({ query, topic, llmProvider }) {
  const heuristic = () => {
    const low = `${query} ${topic}`.toLowerCase();
    if (['tcp', 'http', 'network', 'congestion'].some((x) => low.includes(x))) {
      return { query, domain: 'computer networking', categories: ['standards', 'official_documentation', 'university'] };
    }
    if (['python', 'pytorch', 'tensorflow', 'sql'].some((x) => low.includes(x))) {
      return { query, domain: 'computer science', categories: ['official_documentation', 'university', 'professional_research'] };
    }
    if (['quantum', 'physics'].some((x) => low.includes(x))) {
      return { query, domain: 'physics and quantum computing', categories: ['university', 'professional_research', 'scientific_institute'] };
    }
    return { query, domain: 'technology', categories: ['university', 'professional_research', 'official_documentation'] };
  };
  if (llmProvider) {
    try {
      const data = await llmProvider.completeJson({
        task: 'plan_trusted_source_discovery',
        system:
          'Plan trusted academic source discovery. Return JSON {"query":string,"domain":string,"preferred_categories":[string]}. ' +
          'Do not invent URLs. Use categories like official_documentation, standards, university, professional_research, peer_reviewed, scientific_institute.',
        user: `Student question=${query}\nTopic=${topic}`,
      });
      const categories = Array.isArray(data?.preferred_categories)
        ? data.preferred_categories.map(String).filter(Boolean)
        : [];
      return {
        query: String(data?.query ?? query).trim() || query,
        domain: String(data?.domain ?? 'technology').trim() || 'technology',
        categories: categories.length > 0 ? categories : heuristic().categories,
      };
    } catch {
      // LLM planning is an optimization only; heuristics are the floor.
    }
  }
  return heuristic();
}

export function isWebSearchEnabled() {
  return config.webSearch.enabled && Boolean(config.webSearch.tavilyApiKey);
}

/**
 * Live trusted search through Tavily + trust gating (port of
 * TavilyTrustedSearch.search). Never throws for "nothing trusted": returns
 * { state, sources } so callers can abstain honestly.
 */
export async function searchTrustedSources({ query, categories = [] }) {
  if (!isWebSearchEnabled()) {
    return { state: 'unavailable', sources: [] };
  }
  let payload;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: config.webSearch.tavilyApiKey,
        query,
        search_depth: 'advanced',
        max_results: 8,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return { state: `unavailable:tavily_${response.status}`, sources: [] };
    }
    payload = await response.json();
  } catch (error) {
    return { state: `unavailable:${error.name}`, sources: [] };
  }
  const sources = [];
  for (const item of payload?.results ?? []) {
    const url = String(item?.url ?? '');
    const [authority, score] = trustOf(url);
    if (score < config.webSearch.trustThreshold) continue;
    if (
      categories.length > 0 &&
      !categories.includes(authority) &&
      !ALWAYS_ALLOWED_AUTHORITIES.has(authority)
    ) {
      continue;
    }
    const text = await (async () => {
      try {
        const fetched = await safeFetchText(url);
        return fetched.text;
      } catch {
        return String(item?.content ?? '').trim();
      }
    })();
    if (text.length < 120) continue;
    const hostname = (() => {
      try {
        return new URL(url).hostname ?? '';
      } catch {
        return '';
      }
    })();
    sources.push({
      title: String(item?.title ?? ''),
      url,
      domain: hostname,
      authority,
      trustScore: score,
      text,
    });
  }
  if (sources.length === 0) {
    return { state: 'no_trusted_results', sources: [] };
  }
  return { state: 'ready', sources };
}
