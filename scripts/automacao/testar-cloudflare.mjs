// Teste manual da Cloudflare Workers AI: pede UMA imagem ao modelo FLUX-1-schnell. Nunca imprime o token.
const conta = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!conta || !token) { console.log('Faltam os Secrets CLOUDFLARE_ACCOUNT_ID e/ou CLOUDFLARE_API_TOKEN.'); process.exit(1); }

const v = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { Authorization: `Bearer ${token}` } });
const vj = await v.json().catch(() => ({}));
console.log(`token/verify → HTTP ${v.status}, status: ${vj.result?.status ?? JSON.stringify(vj.errors ?? []).slice(0, 150)}`);

const modelo = '@cf/black-forest-labs/flux-1-schnell';
const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/ai/run/${modelo}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: 'Flat vector illustration for a science blog: a simple food chain with grass, a rabbit and a fox, soft colors, no text, no logos.', steps: 4 }),
});
const j = await r.json().catch(() => ({}));
const b64 = j.result?.image;
if (r.ok && b64) {
  const buf = Buffer.from(b64, 'base64');
  const tipo = buf[0] === 0xff ? 'JPEG' : buf[0] === 0x89 ? 'PNG' : 'desconhecido';
  console.log(`${modelo} → OK: imagem ${tipo}, ${Math.round(buf.length / 1024)} KB`);
  console.log('RESULTADO: a Cloudflare consegue gerar imagens com este token.');
  process.exit(0);
}
console.log(`${modelo} → HTTP ${r.status}: ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
console.log('RESULTADO: não gerou (veja o erro acima).');
process.exit(1);
