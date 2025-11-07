#!/usr/bin/env tsx

import neo4j from 'neo4j-driver';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

async function debugWorkspace(workspaceName: string) {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  try {
    const session = driver.session();

    console.log(`\n========================================`);
    console.log(`WORKSPACE: ${workspaceName}`);
    console.log(`========================================\n`);

    // 1. Check Videos
    console.log('--- VIDEOS ---');
    const videoResult = await session.run(
      `MATCH (v:Video {workspace: $workspace})
       RETURN v.video_id as video_id, v.url as url
       ORDER BY v.video_id
       LIMIT 10`,
      { workspace: workspaceName }
    );
    console.log(`Found ${videoResult.records.length} videos:`);
    videoResult.records.forEach(record => {
      console.log(`  - ${record.get('video_id')}: ${record.get('url')}`);
    });

    // 2. Check Segments
    console.log('\n--- SEGMENTS ---');
    const segmentResult = await session.run(
      `MATCH (s:Segment {workspace: $workspace})
       RETURN s.segment_id as segment_id, s.topic_hint as topic, s.video_id as video_id
       ORDER BY s.segment_id
       LIMIT 10`,
      { workspace: workspaceName }
    );
    console.log(`Found ${segmentResult.records.length} segments:`);
    segmentResult.records.forEach(record => {
      console.log(`  - ${record.get('segment_id')}: ${record.get('topic')} (video: ${record.get('video_id')})`);
    });

    // 3. Check Concepts
    console.log('\n--- CONCEPTS ---');
    const conceptResult = await session.run(
      `MATCH (c:Concept {workspace: $workspace})
       RETURN c.concept_id as concept_id, c.canonical_name as name
       ORDER BY c.concept_id
       LIMIT 10`,
      { workspace: workspaceName }
    );
    console.log(`Found ${conceptResult.records.length} concepts:`);
    conceptResult.records.forEach(record => {
      console.log(`  - ${record.get('concept_id')}: ${record.get('name')}`);
    });

    // 4. Check Relationships - Segments to Videos
    console.log('\n--- SEGMENT->VIDEO RELATIONSHIPS ---');
    const segmentVideoRel = await session.run(
      `MATCH (s:Segment {workspace: $workspace})-[r:FROM_VIDEO]->(v:Video)
       RETURN count(r) as count`,
      { workspace: workspaceName }
    );
    console.log(`Found ${segmentVideoRel.records[0].get('count').toNumber()} FROM_VIDEO relationships`);

    // 5. Check Relationships - Segments to Concepts
    console.log('\n--- SEGMENT->CONCEPT RELATIONSHIPS ---');
    const segmentConceptRel = await session.run(
      `MATCH (s:Segment {workspace: $workspace})-[r:DISCUSSES]->(c:Concept {workspace: $workspace})
       RETURN count(r) as count`,
      { workspace: workspaceName }
    );
    console.log(`Found ${segmentConceptRel.records[0].get('count').toNumber()} DISCUSSES relationships`);

    // 6. Check for mismatched workspace relationships
    console.log('\n--- CHECKING FOR WORKSPACE MISMATCHES ---');
    const mismatchCheck = await session.run(
      `MATCH (s:Segment {workspace: $workspace})-[r:DISCUSSES]->(c:Concept)
       WHERE c.workspace <> $workspace
       RETURN count(r) as count`,
      { workspace: workspaceName }
    );
    const mismatches = mismatchCheck.records[0].get('count').toNumber();
    if (mismatches > 0) {
      console.log(`⚠️  WARNING: Found ${mismatches} relationships pointing to concepts in different workspaces!`);
    } else {
      console.log('✓ No workspace mismatches found');
    }

    // 7. Sample some segment-concept links
    console.log('\n--- SAMPLE SEGMENT->CONCEPT LINKS ---');
    const sampleLinks = await session.run(
      `MATCH (s:Segment {workspace: $workspace})-[r:DISCUSSES]->(c:Concept {workspace: $workspace})
       RETURN s.segment_id as segment_id, s.topic_hint as topic, c.concept_id as concept_id, c.canonical_name as concept_name, r.role as role
       LIMIT 5`,
      { workspace: workspaceName }
    );
    if (sampleLinks.records.length === 0) {
      console.log('⚠️  No linked segments and concepts found!');
    } else {
      sampleLinks.records.forEach(record => {
        console.log(`  - Segment "${record.get('topic')}" -> Concept "${record.get('concept_name')}" (${record.get('role')})`);
      });
    }

    await session.close();
  } finally {
    await driver.close();
  }
}

async function checkAllWorkspaces() {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  try {
    const session = driver.session();

    console.log('\n========================================');
    console.log('ALL WORKSPACES IN DATABASE');
    console.log('========================================\n');

    const result = await session.run(
      `MATCH (n)
       WHERE n.workspace IS NOT NULL
       RETURN DISTINCT n.workspace as workspace, labels(n)[0] as label, count(*) as count
       ORDER BY workspace, label`
    );

    result.records.forEach(record => {
      console.log(`  ${record.get('workspace')} - ${record.get('label')}: ${record.get('count').toNumber()} nodes`);
    });

    await session.close();
  } finally {
    await driver.close();
  }
}

// Main execution
(async () => {
  try {
    await checkAllWorkspaces();
    await debugWorkspace('shopify');
    await debugWorkspace('micro_conf');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
