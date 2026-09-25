// Fila de peças para as redes, em JSON — fonte do n8n para Facebook e Pinterest.
// Cada artigo traz imagem + texto + link com UTM; o n8n decide o quando (regra dos 60 dias na planilha).
import type { APIRoute } from 'astro';
import { getArticles } from '../lib/articles';
import { socialPack } from '../lib/social';

export const GET: APIRoute = async () => {
  const items = (await getArticles()).slice(0, 100).map(socialPack);
  return new Response(JSON.stringify({ generated: new Date().toISOString(), items }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
