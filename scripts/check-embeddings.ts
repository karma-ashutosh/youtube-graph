import * as dotenv from 'dotenv';
import { getSession } from '../lib/neo4j/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function checkEmbeddings() {
  const session = getSession();

  try {
    // Check concepts with embeddings
    const conceptResult = await session.run(`
      MATCH (c:Concept)
      WHERE c.workspace = 'micro_conf'
      RETURN
        count(c) as total,
        count(c.embedding) as with_embedding,
        count(CASE WHEN c.embedding IS NULL THEN 1 END) as without_embedding
    `);

    const conceptStats = conceptResult.records[0];
    console.log('Concepts in micro_conf workspace:');
    console.log(`  Total: ${conceptStats.get('total')}`);
    console.log(`  With embedding: ${conceptStats.get('with_embedding')}`);
    console.log(`  Without embedding: ${conceptStats.get('without_embedding')}`);
    console.log();

    // Check segments with embeddings
    const segmentResult = await session.run(`
      MATCH (s:Segment)
      WHERE s.workspace = 'micro_conf'
      RETURN
        count(s) as total,
        count(s.embedding) as with_embedding,
        count(CASE WHEN s.embedding IS NULL THEN 1 END) as without_embedding
    `);

    const segmentStats = segmentResult.records[0];
    console.log('Segments in micro_conf workspace:');
    console.log(`  Total: ${segmentStats.get('total')}`);
    console.log(`  With embedding: ${segmentStats.get('with_embedding')}`);
    console.log(`  Without embedding: ${segmentStats.get('without_embedding')}`);
    console.log();

    // Sample a concept with embedding
    const sampleConcept = await session.run(`
      MATCH (c:Concept)
      WHERE c.workspace = 'micro_conf' AND c.embedding IS NOT NULL
      RETURN c.canonical_name, size(c.embedding) as embedding_size
      LIMIT 1
    `);

    if (sampleConcept.records.length > 0) {
      const record = sampleConcept.records[0];
      console.log(`Sample concept: "${record.get('canonical_name')}" has embedding of size ${record.get('embedding_size')}`);
    }
  } finally {
    await session.close();
  }
}

checkEmbeddings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
