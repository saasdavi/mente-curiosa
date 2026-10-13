import type { APIRoute } from 'astro';
import { SITE } from '../config/site';

// Bots de IA liberados de propósito: é o que faz o conteúdo ser citado em respostas de
// ChatGPT, Claude, Perplexity, Gemini, Copilot e Apple Intelligence (GEO/AEO).
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Bingbot',
  'meta-externalagent',
  'Applebot-Extended',
  'CCBot',
];

export const GET: APIRoute = () =>
  new Response(
    [
      '# Mente Curiosa — robots.txt',
      '',
      'User-agent: *',
      'Allow: /',
      'Disallow: /migration-map.csv',
      'Disallow: /api/',
      '',
      '# --- Bots de IA (GEO/AEO) ---',
      ...AI_BOTS.flatMap((bot) => [`User-agent: ${bot}`, 'Allow: /', '']),
      `Sitemap: ${new URL('/sitemap.xml', SITE.url).href}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
