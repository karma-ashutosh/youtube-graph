import { NextResponse } from "next/server";
import { getAllConcepts } from "@/lib/neo4j/queries";

/**
 * GET /api/concepts
 *
 * Returns all concepts in the knowledge graph
 */
export async function GET() {
  try {
    const concepts = await getAllConcepts();

    return NextResponse.json({
      success: true,
      total: concepts.length,
      concepts,
    });
  } catch (error) {
    console.error("Error fetching concepts:", error);

    return NextResponse.json(
      { error: "Failed to fetch concepts" },
      { status: 500 }
    );
  }
}
