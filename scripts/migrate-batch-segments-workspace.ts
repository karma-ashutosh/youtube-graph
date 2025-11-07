/**
 * Migration Script: Re-ingest batch segments with correct workspace
 *
 * This script re-processes segments from batch_segments table with the correct workspace.
 * Useful for fixing segments that were ingested with the wrong workspace.
 *
 * Usage:
 *   # Migrate all segments from a specific channel
 *   npx tsx scripts/migrate-batch-segments-workspace.ts \
 *     --channel "YCombinator" \
 *     --from-workspace "micro_conf" \
 *     --to-workspace "ycombinator"
 *
 *   # Migrate all segments from a batch
 *   npx tsx scripts/migrate-batch-segments-workspace.ts \
 *     --batch-id "uuid-here" \
 *     --from-workspace "micro_conf" \
 *     --to-workspace "new_workspace"
 *
 *   # Migrate by video URL pattern
 *   npx tsx scripts/migrate-batch-segments-workspace.ts \
 *     --video-pattern "watch?v=abc" \
 *     --from-workspace "micro_conf" \
 *     --to-workspace "target_workspace"
 *
 *   # Dry run (show what would be migrated without actually doing it)
 *   npx tsx scripts/migrate-batch-segments-workspace.ts \
 *     --channel "YCombinator" \
 *     --from-workspace "micro_conf" \
 *     --to-workspace "ycombinator" \
 *     --dry-run
 */

import * as dotenv from 'dotenv';
import pool from '../lib/db';
import { ingestSegment } from '../lib/utils/ingest';
import { runWithWorkspaceAsync } from '../lib/workspace-context';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

interface MigrationOptions {
  channel?: string;
  batchId?: string;
  videoPattern?: string;
  fromWorkspace: string;
  toWorkspace: string;
  dryRun: boolean;
}

async function parseArgs(): Promise<MigrationOptions> {
  const args = process.argv.slice(2);
  const options: Partial<MigrationOptions> = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--channel' && i + 1 < args.length) {
      options.channel = args[++i];
    } else if (arg === '--batch-id' && i + 1 < args.length) {
      options.batchId = args[++i];
    } else if (arg === '--video-pattern' && i + 1 < args.length) {
      options.videoPattern = args[++i];
    } else if (arg === '--from-workspace' && i + 1 < args.length) {
      options.fromWorkspace = args[++i];
    } else if (arg === '--to-workspace' && i + 1 < args.length) {
      options.toWorkspace = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  if (!options.fromWorkspace || !options.toWorkspace) {
    console.error('❌ Error: Both --from-workspace and --to-workspace are required');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/migrate-batch-segments-workspace.ts \\');
    console.log('    --channel "ChannelName" \\');
    console.log('    --from-workspace "micro_conf" \\');
    console.log('    --to-workspace "new_workspace"');
    console.log('\nOptions:');
    console.log('  --channel <name>           Filter by channel name (searches in video_url)');
    console.log('  --batch-id <uuid>          Filter by batch ID');
    console.log('  --video-pattern <text>     Filter by video URL pattern');
    console.log('  --from-workspace <name>    Source workspace to migrate FROM (required)');
    console.log('  --to-workspace <name>      Target workspace to migrate TO (required)');
    console.log('  --dry-run                  Show what would be migrated without doing it');
    console.log('\nNote: The script will DELETE data from the source workspace and re-ingest to the target workspace.');
    process.exit(1);
  }

  if (!options.channel && !options.batchId && !options.videoPattern) {
    console.error('❌ Error: At least one filter is required (--channel, --batch-id, or --video-pattern)');
    process.exit(1);
  }

  return options as MigrationOptions;
}

async function findSegments(options: MigrationOptions): Promise<any[]> {
  const client = await pool.connect();

  try {
    let query = `
      SELECT
        bs.id,
        bs.batch_id,
        bs.segment_index,
        bs.segment_data,
        bs.status
      FROM batch_segments bs
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.batchId) {
      query += ` AND bs.batch_id = $${paramIndex++}`;
      params.push(options.batchId);
    }

    if (options.channel) {
      query += ` AND bs.segment_data->>'video_url' ILIKE $${paramIndex++}`;
      params.push(`%${options.channel}%`);
    }

    if (options.videoPattern) {
      query += ` AND bs.segment_data->>'video_url' LIKE $${paramIndex++}`;
      params.push(`%${options.videoPattern}%`);
    }

    query += ` ORDER BY bs.batch_id, bs.segment_index`;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function deleteOldData(segmentIds: string[], fromWorkspace: string) {
  const { getDriver } = await import('../lib/neo4j/client');
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log(`\n🗑️  Deleting old data from workspace '${fromWorkspace}'...`);

    // Delete segments and their relationships
    const result = await session.run(`
      MATCH (s:Segment)
      WHERE s.segment_id IN $segmentIds
        AND s.workspace = $fromWorkspace
      WITH s
      // Delete related examples and key ideas
      OPTIONAL MATCH (s)<-[:FROM_SEGMENT]-(e:Example)
      OPTIONAL MATCH (s)<-[:FROM_SEGMENT]-(ki:KeyIdea)
      DETACH DELETE s, e, ki
      RETURN count(s) as deletedSegments
    `, {
      segmentIds,
      fromWorkspace
    });

    const deletedCount = result.records[0]?.get('deletedSegments').toNumber() || 0;
    console.log(`✅ Deleted ${deletedCount} segments and their related data from '${fromWorkspace}'\n`);
  } finally {
    await session.close();
  }
}

async function migrateSegments(options: MigrationOptions) {
  console.log('🔍 Finding segments to migrate...\n');

  const segments = await findSegments(options);

  if (segments.length === 0) {
    console.log('❌ No segments found matching the criteria.\n');
    return;
  }

  console.log(`📊 Found ${segments.length} segments to migrate\n`);

  // Group by batch for display
  const byBatch = segments.reduce((acc, seg) => {
    if (!acc[seg.batch_id]) {
      acc[seg.batch_id] = [];
    }
    acc[seg.batch_id].push(seg);
    return acc;
  }, {} as Record<string, any[]>);

  console.log('Batches:');
  for (const [batchId, segs] of Object.entries(byBatch)) {
    const sampleUrl = segs[0].segment_data.video_url;
    console.log(`  - ${batchId} (${segs.length} segments) - ${sampleUrl}`);
  }

  if (options.dryRun) {
    console.log('\n✅ Dry run complete. Use without --dry-run to perform the migration.\n');
    return;
  }

  console.log(`\n🚀 Starting migration from '${options.fromWorkspace}' to '${options.toWorkspace}'`);

  // Delete old data from the source workspace
  const segmentIds = segments.map(s => {
    const data = s.segment_data;
    const videoId = data.video_url.match(/(?:v=|\/videos\/)([a-zA-Z0-9_-]+)/)?.[1] || 'unknown';
    const startTime = parseTime(data.start_time);
    const endTime = parseTime(data.end_time);
    return `${videoId}_${String(startTime).padStart(6, '0')}_${String(endTime).padStart(6, '0')}`;
  });

  await deleteOldData(segmentIds, options.fromWorkspace);

  let successCount = 0;
  let failCount = 0;
  const errors: Array<{index: number, error: string}> = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentData = segment.segment_data;

    process.stdout.write(`\r⏳ Processing ${i + 1}/${segments.length}...`);

    try {
      // Re-ingest the segment with the target workspace
      await runWithWorkspaceAsync(options.toWorkspace, async () => {
        const result = await ingestSegment(segmentData);

        if (!result.success) {
          throw new Error(result.error || 'Ingestion failed');
        }
      });

      successCount++;
    } catch (error: any) {
      failCount++;
      errors.push({
        index: segment.segment_index,
        error: error.message
      });
    }
  }

  console.log('\n');
  console.log('✨ Migration complete!\n');
  console.log(`📈 Results:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.slice(0, 10).forEach(err => {
      console.log(`  - Segment ${err.index}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  console.log(`\n💡 Data migrated from '${options.fromWorkspace}' to '${options.toWorkspace}'`);
  console.log('   You can now switch to this workspace in the UI at /workspaces\n');
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(timeStr);
}

// Main execution
parseArgs()
  .then(options => migrateSegments(options))
  .then(() => {
    console.log('🎉 Script finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
