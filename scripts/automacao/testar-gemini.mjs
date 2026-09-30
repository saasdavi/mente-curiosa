// Teste manual da chave do Gemini: lista os modelos de imagem disponíveis e pede UMA imagem. Nunca imprime a chave.
const chave = process.env.GEMINI_API_KEY;
if (!chave) { console.log('GEMINI_API_KEY não definida no Secret.'); process.exit(1); }
const base = 'https://generativelanguage.googleapis.com/v1beta';
const h = { 'x-goog-api-key': chave, 'content-type': 'application/json' };

const lista = await fetch(`${base}/models?pageSize=200`, { headers: h });
console.log(`models.list → HTTP ${lista.status}`);
if (!lista.ok) { console.log((await lista.text()).slice(0, 400)); process.exit(1); }
const modelos = (await lista.json()).models ?? [];
const imagem = modelos.filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent')).map((m) => m.name.replace('models/', ''));
console.log(`modelos de imagem com generateContent: ${imagem.join(', ') || 'nenhum'}`);

let gerou = false;
for (const nome of imagem) {
  const r = await fetch(`${base}/models/${nome}:generateContent`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Flat vector illustration for a science blog: a simple food chain with grass, a rabbit and a fox, soft colors, no text, no logos.' }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  const corpo = await r.json().catch(() => ({}));
  const parte = (corpo.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (r.ok && parte) {
    console.log(`${nome} → OK: imagem ${parte.inlineData.mimeType}, ${Math.round((parte.inlineData.data.length * 3) / 4 / 1024)} KB`);
    gerou = true;
    break;
  }
  console.log(`${nome} → HTTP ${r.status}: ${JSON.stringify(corpo.error?.message ?? corpo).slice(0, 160)}`);
}
console.log(gerou ? 'RESULTADO: a chave consegue gerar imagens.' : 'RESULTADO: nenhum modelo de imagem gerou (veja o erro acima, provavelmente cota ou plano).');
process.exit(gerou ? 0 : 1);
