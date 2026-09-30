// Marca como "publicado" as pautas "agendado" cuja data já chegou. Roda no início da geração diária.
import { CFG } from './config.mjs';
import { hojeBR } from './util.mjs';
import { lerCalendario, gravarCelulas } from './sheets.mjs';

const hoje = hojeBR(CFG.fusoHorario);
const { linhas, colunas, token } = await lerCalendario({ sheetId: process.env.SHEET_ID, credenciais: process.env.GOOGLE_SHEETS_CREDENTIALS });
const alvo = linhas.filter((l) => String(l['Status']).trim().toLowerCase() === 'agendado' && l.dataISO && l.dataISO <= hoje);
await gravarCelulas({
  sheetId: process.env.SHEET_ID, token, colunas,
  atualizacoes: alvo.flatMap((l) => [{ linha: l._linha, coluna: 'Status', valor: 'publicado' }, { linha: l._linha, coluna: 'Data Publicação', valor: l.dataISO }]),
});
console.log(`status atualizado para "publicado": ${alvo.length} pauta(s) (hoje ${hoje})`);
