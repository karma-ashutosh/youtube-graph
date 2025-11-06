/**
 * Direct script to check and create vector indices
 * Note: Indices are shared across workspaces (not workspace-specific)
 */

import * as dotenv from 'dotenv';
import { getDriver } from '../lib/neo4j/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function fixIndices() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log('📋 Checking existing indices...\n');

    const indicesResult = await session.run(`
      SHOW INDEXES
      YIELD name, type, labelsOrTypes, properties
      WHERE type = 'VECTOR'
      RETURN name, type, labelsOrTypes, properties
    `);

    console.log('Existing vector indices:');
    for (const record of indicesResult.records) {
      console.log(`  - ${record.get('name')}: ${record.get('labelsOrTypes')} (${record.get('properties')})`);
    }
    console.log();

    // Try to create concept index (shared across workspaces)
    console.log('🔧 Creating concept_embeddings...');
    try {
      await session.run(`
        CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
        FOR (c:Concept)
        ON c.embedding
        OPTIONS {indexConfig: {
          \`vector.dimensions\`: 768,
          \`vector.similarity_function\`: 'cosine'
        }}
      `);
      console.log('✅ Concept index created\n');
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('equivalent index')) {
        console.log('⚠️  Concept index already exists\n');
      } else {
        console.error('Error creating concept index:', err.message);
        throw err;
      }
    }

    // Try to create segment index (shared across workspaces)
    console.log('🔧 Creating segment_embeddings...');
    try {
      await session.run(`
        CREATE VECTOR INDEX segment_embeddings IF NOT EXISTS
        FOR (s:Segment)
        ON s.embedding
        OPTIONS {indexConfig: {
          \`vector.dimensions\`: 768,
          \`vector.similarity_function\`: 'cosine'
        }}
      `);
      console.log('✅ Segment index created\n');
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('equivalent index')) {
        console.log('⚠️  Segment index already exists\n');
      } else {
        console.error('Error creating segment index:', err.message);
        throw err;
      }
    }

    // Check final state
    console.log('📊 Final indices check...\n');
    const finalResult = await session.run(`
      SHOW INDEXES
      YIELD name, type
      WHERE type = 'VECTOR'
      RETURN name, type
    `);

    console.log('All vector indices:');
    for (const record of finalResult.records) {
      console.log(`  - ${record.get('name')}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

fixIndices()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
