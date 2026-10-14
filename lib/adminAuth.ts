import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/**
 * Opt-in admin guard. Enforced only when ADMIN_SECRET is set;
 * when unset, returns null and the route behaves exactly as before.
 * Returns a 401 NextResponse when the bearer token is missing or wrong.
 */
export function checkAdminAuth(req: Request): NextResponse | null {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return null;

    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${secret}`;
    if (authHeader && safeEqual(authHeader, expected)) return null;

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
