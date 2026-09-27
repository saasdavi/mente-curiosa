#!/usr/bin/env node

/**
 * pinterest-variants-gemini.js
 * Gera 5 variações únicas de título, descrição e hashtags usando Gemini API (FREE)
 * Para distribuição em Pinterest com máxima variedade de ângulos
 */

const fs = require('fs');
const path = require('path');

// Variáveis de ambiente
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ARTICLE_SLUG = process.env.ARTICLE_SLUG;
const ARTICLE_TITLE = process.env.ARTICLE_TITLE;
const ARTICLE_SUMMARY = process.env.ARTICLE_SUMMARY;

if (!GEMINI_API_KEY || !ARTICLE_SLUG || !ARTICLE_TITLE) {
  console.error('❌ Faltam env vars: GEMINI_API_KEY, ARTICLE_SLUG, ARTICLE_TITLE');
  process.exit(1);
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function generateVariations() {
  const prompt = `Você é um especialista em copywriting para Pinterest e redes sociais.

Crie 5 variações COMPLETAMENTE DIFERENTES de título, descrição e hashtags para este artigo:

**Título do artigo:** ${ARTICLE_TITLE}
**Resumo:** ${ARTICLE_SUMMARY || 'Artigo sobre curiosidades e psicologia humana'}

IMPORTANTE: Cada variação deve ter um ângulo/abordagem DIFERENTE:
1. Pergunta curiosa
2. Descoberta científica
3. Aplicação prática
4. Fato surpreendente
5. Reflexão pessoal

Para CADA variação, retorne EXATAMENTE neste formato JSON (válido):
- title: máx 100 caracteres
- description: máx 150 caracteres
- hashtags: 5-8 tags (ex: #tag1 #tag2)

Responda APENAS com JSON, nada mais:

\`\`\`json
{
  "variations": [
    {
      "variant": 1,
      "angle": "curiosidade",
      "title": "...",
      "description": "...",
      "hashtags": "#tag1 #tag2"
    },
    {
      "variant": 2,
      "angle": "descoberta",
      "title": "...",
      "description": "...",
      "hashtags": "#tag3 #tag4"
    },
    {
      "variant": 3,
      "angle": "prática",
      "title": "...",
      "description": "...",
      "hashtags": "#tag5 #tag6"
    },
    {
      "variant": 4,
      "angle": "surpreendente",
      "title": "...",
      "description": "...",
      "hashtags": "#tag7 #tag8"
    },
    {
      "variant": 5,
      "angle": "reflexão",
      "title": "...",
      "description": "...",
      "hashtags": "#tag9 #tag10"
    }
  ]
}
\`\`\`

Lembre-se:
- Nenhuma repetição entre variações
- Linguagem conversacional, não robótica
- Adequado para público BR
- Sem aspas nos textos
- Keyword do título quando possível`;

  try {
    console.log('📝 Gerando 5 variações com Gemini API Free...');

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1500,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No candidates in Gemini response');
    }

    const content = data.candidates[0].content.parts[0].text;

    // Extrai JSON da resposta
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.error('Raw response:', content);
      throw new Error('Could not extract JSON from Gemini response');
    }

    const variations = JSON.parse(jsonMatch[1]);

    // Valida estrutura
    if (!variations.variations || !Array.isArray(variations.variations)) {
      throw new Error('Invalid variations structure');
    }

    if (variations.variations.length !== 5) {
      throw new Error(`Expected 5 variations, got ${variations.variations.length}`);
    }

    // Salva no arquivo de output
    const outputDir = path.join(process.cwd(), 'src', 'content', 'pinterest');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `${ARTICLE_SLUG}-variants.json`);
    fs.writeFileSync(outputFile, JSON.stringify(variations, null, 2));

    console.log(`✅ Variações salvas: ${outputFile}`);
    console.log(`📊 5 ângulos diferentes gerados`);
    
    variations.variations.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.angle}: "${v.title.substring(0, 50)}..."`);
    });

    return variations;
  } catch (error) {
    console.error('❌ Erro ao gerar variações:', error.message);
    process.exit(1);
  }
}

generateVariations();
