#!/usr/bin/env npx tsx

/**
 * Script to truncate all data from Neo4j database
 * Uses credentials from terraform/terraform.tfvars
 */

import neo4j from 'neo4j-driver';
import * as fs from 'fs';
import * as path from 'path';

// Parse terraform.tfvars file
function parseTerraformVars(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars: Record<string, string> = {};

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^(\w+)\s*=\s*"([^"]*)"/);
      if (match) {
        vars[match[1]] = match[2];
      }
    }
  }

  return vars;
}

async function truncateDatabase() {
  console.log('=========================================');
  console.log('Neo4j Database Truncate Script');
  console.log('=========================================\n');

  // Load terraform vars
  const tfVarsPath = path.join(process.cwd(), 'terraform', 'terraform.tfvars');
  console.log(`Reading credentials from: ${tfVarsPath}`);

  if (!fs.existsSync(tfVarsPath)) {
    console.error('Error: terraform/terraform.tfvars not found');
    process.exit(1);
  }

  const vars = parseTerraformVars(tfVarsPath);
  const uri = vars.neo4j_uri;
  const user = vars.neo4j_user;
  const password = vars.neo4j_password;

  if (!uri || !user || !password) {
    console.error('Error: Missing Neo4j credentials in terraform.tfvars');
    process.exit(1);
  }

  console.log(`Connecting to: ${uri}`);
  console.log(`User: ${user}\n`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  try {
    // Step 1: Count current nodes
    console.log('Step 1: Counting current nodes...');
    const countResult = await session.run('MATCH (n) RETURN count(n) as count');
    const nodeCount = countResult.records[0].get('count').toNumber();
    console.log(`Current nodes: ${nodeCount}\n`);

    // Step 2: Delete all nodes and relationships
    console.log('Step 2: Deleting all nodes and relationships...');
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✓ All data deleted\n');

    // Step 3: Drop all constraints
    console.log('Step 3: Dropping all constraints...');
    const constraintsResult = await session.run('SHOW CONSTRAINTS');
    const constraints = constraintsResult.records;

    if (constraints.length === 0) {
      console.log('No constraints found');
    } else {
      for (const record of constraints) {
        const name = record.get('name');
        console.log(`Dropping constraint: ${name}`);
        await session.run(`DROP CONSTRAINT ${name} IF EXISTS`);
      }
    }
    console.log('✓ All constraints dropped\n');

    // Step 4: Drop all indexes
    console.log('Step 4: Dropping all indexes...');
    const indexesResult = await session.run('SHOW INDEXES');
    const indexes = indexesResult.records;

    if (indexes.length === 0) {
      console.log('No indexes found');
    } else {
      for (const record of indexes) {
        const name = record.get('name');
        const type = record.get('type');
        // Skip constraint-backed indexes as they're dropped with constraints
        if (!type.includes('CONSTRAINT')) {
          console.log(`Dropping index: ${name}`);
          await session.run(`DROP INDEX ${name} IF EXISTS`);
        }
      }
    }
    console.log('✓ All indexes dropped\n');

    // Step 5: Recreate constraints
    console.log('Step 5: Recreating constraints...');
    await session.run(
      'CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT video_id_unique IF NOT EXISTS FOR (v:Video) REQUIRE v.video_id IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT segment_id_unique IF NOT EXISTS FOR (s:Segment) REQUIRE s.segment_id IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT workspace_id_unique IF NOT EXISTS FOR (w:Workspace) REQUIRE w.workspace_id IS UNIQUE'
    );
    console.log('✓ Constraints recreated\n');

    // Step 6: Recreate vector indexes
    console.log('Step 6: Recreating vector indexes...');

    // Create concept embeddings index
    await session.run(`
      CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
      FOR (c:Concept)
      ON c.embedding
      OPTIONS {indexConfig: {
        \`vector.dimensions\`: 768,
        \`vector.similarity_function\`: 'cosine'
      }}
    `).catch((err) => {
      if (!err.message.includes('already exists') && !err.message.includes('equivalent index')) {
        throw err;
      }
    });

    // Create segment embeddings index
    await session.run(`
      CREATE VECTOR INDEX segment_embeddings IF NOT EXISTS
      FOR (s:Segment)
      ON s.embedding
      OPTIONS {indexConfig: {
        \`vector.dimensions\`: 768,
        \`vector.similarity_function\`: 'cosine'
      }}
    `).catch((err) => {
      if (!err.message.includes('already exists') && !err.message.includes('equivalent index')) {
        throw err;
      }
    });

    console.log('✓ Vector indexes recreated\n');

    // Step 7: Verify reset
    console.log('Step 7: Verifying reset...');
    const finalCountResult = await session.run('MATCH (n) RETURN count(n) as count');
    const finalCount = finalCountResult.records[0].get('count').toNumber();
    console.log(`Final node count: ${finalCount}`);

    if (finalCount === 0) {
      console.log('✓ Database is completely clean!\n');
    } else {
      console.log(`Warning: Expected 0 nodes, found ${finalCount}\n`);
    }

    console.log('=========================================');
    console.log('Reset Complete!');
    console.log('=========================================\n');
    console.log('Database is now fresh and ready for new data.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

truncateDatabase();
