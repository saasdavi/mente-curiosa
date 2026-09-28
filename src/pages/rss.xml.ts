import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE } from "../config/site";

export async function GET(context: any) {
  const blog = await getCollection("blog");

  return rss({
    title: "Mente Curiosa - Curiosidades e Psicologia Humana",
    description: "Artigos sobre curiosidades, psicologia humana e comportamento. Um amigo explicando coisas interessantes.",
    site: context.site || SITE.url,
    items: blog
      .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description || post.body.slice(0, 200),
        link: `/${post.slug}/`,
        author: post.data.author || "Mente Curiosa",
      })),
    customData: `<language>pt-br</language>`,
  });
}
