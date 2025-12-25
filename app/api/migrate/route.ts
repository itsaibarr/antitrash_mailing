import { NextResponse } from "next/server";
import { migrateFromJsonFile, initDatabase } from "../../../lib/db";

export async function POST(req: Request) {
    try {
        // Initialize database tables if needed
        await initDatabase();

        // Run migration
        await migrateFromJsonFile();

        return NextResponse.json({
            success: true,
            message: "Migration completed successfully"
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Migration error:", msg);
        return NextResponse.json({ error: `Migration failed: ${msg}` }, { status: 500 });
    }
}
