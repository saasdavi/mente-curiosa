/**
 * Gera 5 variações de copy + hashtags para cada artigo
 * Uma variação ÚNICA para cada perfil Pinterest
 * 
 * Entrada: artigo + slug
 * Saída: JSON com 5 variações (profile_1 até profile_5)
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

async function generatePinterestVariants(articleTitle, articleSlug, articleExcerpt) {
  const prompt = `Você é especialista em copywriting para Pinterest. 
Preciso de 5 variações COMPLETAMENTE DIFERENTES de descrição e hashtags para o mesmo artigo.
Cada variação deve ter um ângulo/tom único e ser atrativa para usuários diferentes no Pinterest.

Artigo: "${articleTitle}"
Slug: ${articleSlug}
Excerpt: "${articleExcerpt}"

Retorne um JSON com EXATAMENTE esta estrutura (sem markdown, sem explicação, SÓ JSON):
{
  "profile_1": {
    "angle": "curiosidade científica",
    "title": "título único 1",
    "description": "descrição única 1 (máx 500 chars)",
    "hashtags": "#tag1 #tag2 #tag3"
  },
  "profile_2": {
    "angle": "aplicação prática",
    "title": "título único 2",
    "description": "descrição única 2 (máx 500 chars)",
    "hashtags": "#tag4 #tag5 #tag6"
  },
  "profile_3": {
    "angle": "fato surpreendente",
    "title": "título único 3",
    "description": "descrição única 3 (máx 500 chars)",
    "hashtags": "#tag7 #tag8 #tag9"
  },
  "profile_4": {
    "angle": "pergunta instigante",
    "title": "título único 4",
    "description": "descrição única 4 (máx 500 chars)",
    "hashtags": "#tag10 #tag11 #tag12"
  },
  "profile_5": {
    "angle": "conselho/tip",
    "title": "título único 5",
    "description": "descrição única 5 (máx 500 chars)",
    "hashtags": "#tag13 #tag14 #tag15"
  }
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-1-20250805",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Erro ao parsear JSON:", e);
    console.error("Conteúdo recebido:", content);
    throw e;
  }
}

// Export para uso em scripts
module.exports = { generatePinterestVariants };

// Se executado diretamente
if (require.main === module) {
  (async () => {
    const result = await generatePinterestVariants(
      "Por que bocejamos?",
      "por-que-bocejamos",
      "Descubra os mistérios do bocejo e por que é contagioso"
    );
    console.log(JSON.stringify(result, null, 2));
  })();
}
