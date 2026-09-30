// Planilha Google via API (conta de serviço). A planilha precisa estar compartilhada com o
// e-mail da conta de serviço (campo client_email das credenciais).
import { createSign } from 'node:crypto';
import { buscar, paraISO } from './util.mjs';
import { CFG } from './config.mjs';

function lerCredenciais(bruto) {
  if (!bruto) throw new Error('GOOGLE_SHEETS_CREDENTIALS não definida');
  const texto = bruto.trim().startsWith('{') ? bruto : Buffer.from(bruto, 'base64').toString('utf8');
  const c = JSON.parse(texto);
  if (!c.client_email || !c.private_key) throw new Error('credenciais sem client_email/private_key');
  return c;
}

export async function obterToken(credenciaisBrutas) {
  const c = lerCredenciais(credenciaisBrutas);
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssinatura = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: c.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  })}`;
  const assinatura = createSign('RSA-SHA256').update(semAssinatura).sign(c.private_key).toString('base64url');
  const r = await buscar('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${semAssinatura}.${assinatura}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`falha ao obter token do Google: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

export function letraColuna(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Converte a matriz da planilha em linhas com os cabeçalhos como chave. `_linha` é o número da linha (1 = cabeçalho). */
export function linhasDoCalendario(valores) {
  const [cab, ...resto] = valores;
  const col = Object.fromEntries(cab.map((h, i) => [h, i]));
  const linhas = resto.map((r, i) => {
    const o = { _linha: i + 2 };
    cab.forEach((h, k) => (o[h] = r[k] ?? ''));
    o.dataISO = paraISO(o['Data (AAAA-MM-DD)']) ?? paraISO(o['Data']);
    return o;
  });
  return { linhas, colunas: col };
}

export async function lerCalendario({ sheetId, credenciais }) {
  const token = await obterToken(credenciais);
  const faixa = encodeURIComponent(`'${CFG.abaCalendario}'!${CFG.intervaloCalendario}`);
  const r = await buscar(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${faixa}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const j = await r.json();
  if (!j.values) throw new Error(`não consegui ler o calendário: ${JSON.stringify(j).slice(0, 300)}`);
  return { ...linhasDoCalendario(j.values), token };
}

/** atualizacoes: [{ linha, coluna (nome do cabeçalho), valor }] */
export async function gravarCelulas({ sheetId, token, colunas, atualizacoes }) {
  const data = atualizacoes
    .filter((a) => a.coluna in colunas)
    .map((a) => ({
      range: `'${CFG.abaCalendario}'!${letraColuna(colunas[a.coluna])}${a.linha}`,
      values: [[a.valor]],
    }));
  if (!data.length) return;
  const r = await buscar(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
  if (!r.ok) throw new Error(`falha ao gravar na planilha: ${r.status} ${(await r.text()).slice(0, 300)}`);
}
