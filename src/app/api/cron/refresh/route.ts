import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDashboard } from "@/lib/dashboard";
import { env } from "@/lib/env";

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Hashing first gives equal-length buffers, so timingSafeEqual never leaks the secret's length.
function authorized(header: string | null, secret: string): boolean {
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return Response.json({ error: "cron not configured" }, { status: 500, headers: NO_STORE });
  if (!authorized(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  revalidateTag("github", "max");
  revalidatePath("/");

  let warmed = false;
  try {
    await getDashboard();
    warmed = true;
  } catch (err) {
    console.error("[cron] warm-up failed", err instanceof Error ? err.message : err);
  }

  return Response.json({ revalidated: true, warmed, at: new Date().toISOString() }, { headers: NO_STORE });
}
