export const config = { runtime: "nodejs" };

type RequestLike = { method?: string };
type ResponseLike = { status: (code: number) => ResponseLike; json: (payload: unknown) => void; setHeader: (name: string, value: string) => void };

export default function handler(_req: RequestLike, res: ResponseLike) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({ ok: true, service: "sweet-ai-api" });
}
