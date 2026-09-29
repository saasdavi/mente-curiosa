#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = process.env.SHEET_ID;

if (!ANTHROPIC_API_KEY || !GOOGLE_SHEETS_API_KEY || !SHEET_ID) {
  console.error("❌ Missing required env vars: ANTHROPIC_API_KEY, GOOGLE_SHEETS_API_KEY, SHEET_ID");
  process.exit(1);
}

async function getNextArticle() {
  console.log("📋 Fetching next article from Google Sheets...");
  
  const sheetRange = "pautas-modelo_calendario!A:H";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetRange}?key=${GOOGLE_SHEETS_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);
    
    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length < 2) {
      console.error("❌ No articles found in sheet");
      process.exit(1);
    }
    
    const article = rows.slice(1).find(row => {
      const status = row[7] || "";
      return status.toLowerCase().trim() === "planejado";
    });
    
    if (!article) {
      console.error("❌ No planejado articles found");
      process.exit(1);
    }
    
    return {
      calId: article[0],
      date: article[1],
      title: article[3],
      category: article[4],
      slug: article[7],
      rowIndex: rows.indexOf(article) + 1
    };
  } catch (error) {
    console.error("❌ Error fetching from Sheets:", error.message);
    process.exit(1);
  }
}

async function generateArticle(title, category) {
  console.log(`🤖 Generating article: "${title}"...`);
  
  const prompt = `Write a comprehensive blog post about "${title}" in the category of ${category}. 
The post should be:
- Well-structured with headings
- Around 1500-2000 words
- Engaging and informative
- Optimized for a general Portuguese-speaking audience

Format the output as valid Markdown.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const content = data.content[0]?.text || "";
    
    if (!content) throw new Error("Empty response from Claude");
    
    return content;
  } catch (error) {
    console.error("❌ Error generating with Claude:", error.message);
    process.exit(1);
  }
}

function saveArticle(slug, title, content) {
  console.log(`💾 Saving article to file...`);
  
  const blogDir = path.join(process.cwd(), "src", "content", "blog");
  
  if (!fs.existsSync(blogDir)) {
    fs.mkdirSync(blogDir, { recursive: true });
  }
  
  const filePath = path.join(blogDir, `${slug}.md`);
  
  const frontmatter = `---
title: "${title}"
description: "Article about ${title}"
pubDate: ${new Date().toISOString().split("T")[0]}
heroImage: "/images/default.jpg"
---

`;
  
  const markdown = frontmatter + content;
  
  fs.writeFileSync(filePath, markdown, "utf-8");
  console.log(`✅ Article saved to ${filePath}`);
  
  return filePath;
}

async function updateSheetStatus(rowIndex) {
  console.log("📝 Updating sheet status to publicado...");
  
  const range = `pautas-modelo_calendario!H${rowIndex}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [["publicado"]]
      })
    });
    
    if (!response.ok) {
      console.warn(`⚠️  Could not update sheet (read-only key?), continuing anyway`);
      return;
    }
    
    console.log("✅ Sheet status updated");
  } catch (error) {
    console.warn(`⚠️  Error updating sheet: ${error.message}, continuing anyway`);
  }
}

async function main() {
  try {
    console.log("🚀 Starting article generation...\n");
    
    const article = await getNextArticle();
    console.log(`✅ Found article: "${article.title}"\n`);
    
    const content = await generateArticle(article.title, article.category);
    console.log("✅ Content generated\n");
    
    saveArticle(article.slug, article.title, content);
    
    await updateSheetStatus(article.rowIndex);
    
    console.log("\n✅ Done! Article published.\n");
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main();
