import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/neo4j/client";
import { withWorkspace, getCurrentWorkspace } from "@/lib/workspace-context";

/**
 * GET /api/debug-workspace
 *
 * Debug endpoint to check workspace data
 */
export const GET = withWorkspace(async (request: NextRequest) => {
  try {
    const workspace = getCurrentWorkspace();
    const session = getSession();

    const results: any = {
      workspace,
      timestamp: new Date().toISOString(),
    };

    try {
      // Check all workspaces
      const allWorkspaces = await session.run(
        `MATCH (n)
         WHERE n.workspace IS NOT NULL
         RETURN DISTINCT n.workspace as workspace, labels(n)[0] as label, count(*) as count
         ORDER BY workspace, label`
      );
      results.allWorkspaces = allWorkspaces.records.map(r => ({
        workspace: r.get('workspace'),
        label: r.get('label'),
        count: r.get('count').toNumber()
      }));

      // Check Videos in current workspace
      const videos = await session.run(
        `MATCH (v:Video {workspace: $workspace})
         RETURN v.video_id as video_id, v.url as url
         ORDER BY v.video_id
         LIMIT 10`,
        { workspace }
      );
      results.videos = {
        count: videos.records.length,
        samples: videos.records.map(r => ({
          video_id: r.get('video_id'),
          url: r.get('url')
        }))
      };

      // Check Segments in current workspace
      const segments = await session.run(
        `MATCH (s:Segment {workspace: $workspace})
         RETURN s.segment_id as segment_id, s.topic_hint as topic, s.video_id as video_id
         ORDER BY s.segment_id
         LIMIT 10`,
        { workspace }
      );
      results.segments = {
        count: segments.records.length,
        samples: segments.records.map(r => ({
          segment_id: r.get('segment_id'),
          topic: r.get('topic'),
          video_id: r.get('video_id')
        }))
      };

      // Check Concepts in current workspace
      const concepts = await session.run(
        `MATCH (c:Concept {workspace: $workspace})
         RETURN c.concept_id as concept_id, c.canonical_name as name
         ORDER BY c.concept_id
         LIMIT 10`,
        { workspace }
      );
      results.concepts = {
        count: concepts.records.length,
        samples: concepts.records.map(r => ({
          concept_id: r.get('concept_id'),
          name: r.get('name')
        }))
      };

      // Check Segment->Video relationships
      const segmentVideoRel = await session.run(
        `MATCH (s:Segment {workspace: $workspace})-[r:FROM_VIDEO]->(v:Video)
         RETURN count(r) as count`,
        { workspace }
      );
      results.relationships_segment_to_video = segmentVideoRel.records[0].get('count').toNumber();

      // Check Segment->Concept relationships
      const segmentConceptRel = await session.run(
        `MATCH (s:Segment {workspace: $workspace})-[r:DISCUSSES]->(c:Concept {workspace: $workspace})
         RETURN count(r) as count`,
        { workspace }
      );
      results.relationships_segment_to_concept = segmentConceptRel.records[0].get('count').toNumber();

      // Check for workspace mismatches
      const mismatchCheck = await session.run(
        `MATCH (s:Segment {workspace: $workspace})-[r:DISCUSSES]->(c:Concept)
         WHERE c.workspace <> $workspace
         RETURN count(r) as count`,
        { workspace }
      );
      results.workspace_mismatches = mismatchCheck.records[0].get('count').toNumber();

      // Sample segment-concept links
      const sampleLinks = await session.run(
        `MATCH (s:Segment {workspace: $workspace})-[r:DISCUSSES]->(c:Concept {workspace: $workspace})
         RETURN s.segment_id as segment_id, s.topic_hint as topic, c.concept_id as concept_id, c.canonical_name as concept_name, r.role as role
         LIMIT 5`,
        { workspace }
      );
      results.sample_segment_concept_links = sampleLinks.records.map(r => ({
        segment_id: r.get('segment_id'),
        topic: r.get('topic'),
        concept_id: r.get('concept_id'),
        concept_name: r.get('concept_name'),
        role: r.get('role')
      }));

    } finally {
      await session.close();
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);

    return NextResponse.json(
      {
        error: "Failed to debug workspace",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
