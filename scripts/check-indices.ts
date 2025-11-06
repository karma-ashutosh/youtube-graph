import * as dotenv from 'dotenv';
import { getSession } from '../lib/neo4j/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function checkIndices() {
  const session = getSession();

  try {
    const result = await session.run(`
      SHOW INDEXES
      YIELD name, type, labelsOrTypes, properties
      WHERE type = 'VECTOR'
      RETURN name, type, labelsOrTypes, properties
    `);

    console.log('Vector indices:');
    for (const record of result.records) {
      const name = record.get('name');
      const labels = record.get('labelsOrTypes');
      const props = record.get('properties');
      console.log(`  - ${name}: ${labels} -> ${props}`);
    }

    if (result.records.length === 0) {
      console.log('  (none found)');
    }
  } finally {
    await session.close();
  }
}

checkIndices()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
