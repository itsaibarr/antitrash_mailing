import { NextResponse } from "next/server";
import { getPollResults } from "../../../../../lib/polls";
import { initDatabase } from "../../../../../lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Initialize database tables if needed
        await initDatabase();

        const { id: pollId } = await params;
        const results = await getPollResults(pollId);

        if (!results) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        // Format the results for display
        const formattedResults = {
            poll: {
                id: results.poll.id,
                question: results.poll.question,
                options: results.poll.options,
                totalResponses: results.totalResponses,
                createdAt: results.poll.created_at,
            },
            results: results.poll.options.map((option, index) => ({
                option,
                count: results.optionCounts[index] || 0,
                percentage: results.totalResponses > 0 ? Math.round((results.optionCounts[index] || 0) / results.totalResponses * 100) : 0,
            })),
            responses: results.responses.map(response => ({
                userId: response.telegram_user_id,
                optionIndices: response.option_indices,
                optionTexts: response.option_texts,
                respondedAt: response.responded_at,
            })),
        };

        return NextResponse.json(formattedResults);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Error getting poll results:", msg);
        return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
    }
}
