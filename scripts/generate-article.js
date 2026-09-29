import Anthropic from "@anthropic-ai/sdk";
import SheetsClient from "./sheets-client.js";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const sheetsClient = new SheetsClient(
  process.env.GOOGLE_SHEETS_API_KEY,
  process.env.SHEET_ID
);

async function generateArticle() {
  try {
    // Get the next planned article from Sheets
    const nextArticle = await sheetsClient.getNextPlannedArticle();
    if (!nextArticle) {
      console.log("No planned articles found");
      return;
    }

    console.log(`Generating article: ${nextArticle.titulo}`);

    // Get keywords for this article
    const keywords = await sheetsClient.getKeywordsForArticle(nextArticle.artId);

    // Build the prompt
    const prompt = `Escreva um artigo completo e bem estruturado sobre: "${nextArticle.titulo}"

Categoria: ${nextArticle.categoria}
Slug: ${nextArticle.slug}
Volume de busca: ${nextArticle.vol}
Dificuldade: ${nextArticle.dif}
Palavras-chave: ${keywords.map((k) => k.keyword).join(", ")}

O artigo deve:
1. Ter um título atrativo
2. Incluir uma introdução engajante
3. Ser bem estruturado com subtítulos
4. Ter conteúdo de alta qualidade e informativo
5. Terminar com uma conclusão forte
6. Ser otimizado para SEO

Formato: Markdown com YAML frontmatter. Comece com:
---
title: "[Título do Artigo]"
description: "[Descrição meta]"
pubDate: new Date().toISOString().split('T')[0]
categories: ["${nextArticle.categoria}"]
slug: "${nextArticle.slug}"
---

Depois o corpo do artigo em Markdown.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const articleContent =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Save the article
    const blogDir = "src/content/blog";
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    const filePath = path.join(blogDir, `${nextArticle.slug}.md`);
    fs.writeFileSync(filePath, articleContent);
    console.log(`Article saved to ${filePath}`);

    // Mark as published in Sheets
    await sheetsClient.markAsPublished(nextArticle.calId);
    console.log(`Article marked as published in Sheets`);
  } catch (error) {
    console.error("Error generating article:", error);
    process.exit(1);
  }
}

generateArticle();
