import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getArticle, updateArticle } from "@/lib/db/articles";
import { generateArticleImage } from "@/lib/image-generation";
import { isImageGenerationConfigured } from "@/lib/db/settings";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const { id: projectId, articleId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const article = getArticle(articleId);
    if (!article || article.project_id !== projectId) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (!isImageGenerationConfigured()) {
      return NextResponse.json(
        { error: "Image generation is not configured. Add an API key in Settings → Image." },
        { status: 400 }
      );
    }

    const rawPrompt =
      article.cover_image_prompt?.trim() ||
      (typeof article.title === "string" && article.title
        ? `Create a professional editorial featured image for "${article.title}". Modern composition, clean brand-safe style, realistic lighting, no text overlay.`
        : "Professional editorial featured image");
    const prompt = rawPrompt.slice(0, 500);

    console.log(`[Cover image] Generating for article ${articleId}, prompt length=${prompt.length}`);
    const generated = await generateArticleImage(prompt);
    console.log(`[Cover image] ${generated ? "Success" : "No result"}`);
    if (!generated) {
      return NextResponse.json(
        { error: "Image generation returned no result. Check Settings → Image configuration." },
        { status: 503 }
      );
    }

    updateArticle(articleId, {
      cover_image_base64: generated.base64,
      cover_image_mime_type: generated.mimeType,
      cover_image_prompt: generated.revisedPrompt ?? article.cover_image_prompt ?? prompt,
    });

    return NextResponse.json({
      success: true,
      cover_image_base64: generated.base64,
      cover_image_mime_type: generated.mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cover image regeneration failed";
    const is402 = /402|credits|afford/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: is402 ? 402 : 500 }
    );
  }
}
