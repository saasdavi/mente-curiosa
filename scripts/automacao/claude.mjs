// Chamada à API de mensagens da Anthropic (sem SDK). A chave vem de ANTHROPIC_API_KEY (Secret CLAUDE_API_KEY).
import { buscar } from './util.mjs';
import { CFG } from './config.mjs';

export async function chamarClaude({ system, user, maxTokens = CFG.maxTokensRedator, modelo = CFG.modeloClaude }) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error('ANTHROPIC_API_KEY não definida');
  const r = await buscar('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    timeoutMs: 240000,
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: maxTokens, thinking: { type: 'disabled' }, system, messages: [{ role: 'user', content: user }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`API do Claude: ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
  const texto = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!texto) {
    const tipos = (j.content ?? []).map((b) => b.type).join(',') || 'nenhum';
    throw new Error(`resposta vazia do Claude (modelo=${modelo}, stop_reason=${j.stop_reason}, blocos=${tipos}, uso=${JSON.stringify(j.usage ?? {})})`);
  }
  return { texto, uso: j.usage ?? {}, parou: j.stop_reason };
}

/** Extrai o primeiro objeto JSON de um texto (o modelo às vezes cerca com ```json). */
export function extrairJSON(texto) {
  const limpo = texto.replace(/```(?:json)?/g, '');
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim < ini) throw new Error('JSON não encontrado na resposta');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

/** Pergunta ao Claude sobre uma imagem (JPEG em base64). Usado para conferir se a foto bate com o alt. */
export async function chamarClaudeComImagem({ system, pergunta, imagemBase64, maxTokens = 300, modelo = CFG.modeloClaude }) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error('ANTHROPIC_API_KEY não definida');
  const r = await buscar('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    timeoutMs: 120000,
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagemBase64 } },
            { type: 'text', text: pergunta },
          ],
        },
      ],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`API do Claude (imagem): ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}
