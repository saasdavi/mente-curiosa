// Insere as fotos do corpo (frontmatter `images`) ao fim da seção H2 indicada em `section`.
// Saída: <figure> com <img> lazy + width/height (sem CLS) e <figcaption> com legenda e crédito.
// O texto do artigo continua 100% Markdown — as imagens são dados, fáceis de migrar para o WordPress.

const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
const txt = (value) => ({ type: 'text', value });

function figure(img) {
  const c = img.credit || {};
  const autor = c.url
    ? el('a', { href: c.url, rel: ['noopener', 'nofollow'], target: '_blank' }, [txt(c.author)])
    : txt(c.author || '');
  return el('figure', { className: ['article-figure'] }, [
    el('img', { src: img.src, alt: img.alt, width: img.width, height: img.height, loading: 'lazy', decoding: 'async' }),
    el('figcaption', {}, [
      txt(img.caption + ' '),
      el('span', { className: ['article-figure__credit'] }, [txt('Foto: '), autor, txt(` / ${c.source}`)]),
    ]),
  ]);
}

export default function rehypeArticleImages() {
  return (tree, file) => {
    const images = file.data?.astro?.frontmatter?.images;
    if (!Array.isArray(images) || !images.length) return;
    const kids = tree.children;
    const h2 = kids.map((n, i) => (n.type === 'element' && n.tagName === 'h2' ? i : -1)).filter((i) => i >= 0);
    // Insere de trás para frente para não deslocar os índices.
    const plan = images
      .map((img) => ({ img, at: h2[img.section] ?? kids.length })) // fim da seção N = início do H2 N+1
      .sort((a, b) => b.at - a.at);
    for (const { img, at } of plan) kids.splice(at, 0, figure(img), txt('\n'));
  };
}
