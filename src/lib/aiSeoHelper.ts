import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

export async function generateSeoRecommendations(analysis: unknown) {
  const prompt = `
You are an SEO expert. Given the following website analysis, rewrite its
title and description to improve ranking and propose 3 keyword ideas.

${JSON.stringify(analysis, null, 2)}
  `;
  const client = getClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "No suggestions available.";
}
