import { NextResponse } from "next/server";
import { loadPolls } from "../../../lib/polls";

export async function GET() {
    try {
        const polls = await loadPolls();
        return NextResponse.json(polls);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
