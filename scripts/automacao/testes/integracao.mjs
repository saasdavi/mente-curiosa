// Teste de ponta a ponta (sem rede): escreve um artigo de teste, grava no site, roda o build real e limpa tudo.
// Uso: node scripts/automacao/testes/integracao.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { processarPauta } from '../gerar-do-dia.mjs';
import { gravarArtigo, lerAcervo } from '../artigo.mjs';
import { LINHA, depsFalsas } from './mock.mjs';

const slug = LINHA.Slug;
const limpar = () => {
  rmSync(`src/content/artigos/${slug}.md`, { force: true });
  rmSync(`public/images/${slug}`, { recursive: true, force: true });
};
try {
  const r = await processarPauta(LINHA, lerAcervo(), depsFalsas());
  if (!r.ok) throw new Error(`pipeline reprovou: ${r.motivo}`);
  const criados = gravarArtigo({ frontmatter: r.frontmatter, corpo: r.corpo, imagens: r.imagens });
  console.log('arquivos criados:', criados.length, '| nota da auditoria:', r.nota);
  console.log(readFileSync(`src/content/artigos/${slug}.md`, 'utf8').split('\n').slice(0, 14).join('\n'));
  execFileSync('npm', ['run', 'build'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 });
  console.log('\nBUILD OK com o artigo de teste (schema, auditoria, geração e links).');
  console.log('página do artigo gerada no dist (data futura: não deve existir):', existsSync(`dist/${slug}/index.html`));
} catch (e) {
  console.error('FALHOU:', String(e.stderr || e.stdout || e.message).split('\n').filter(Boolean).slice(-12).join('\n'));
  process.exitCode = 1;
} finally {
  limpar();
  console.log('limpeza feita.');
}
