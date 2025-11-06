import * as dotenv from 'dotenv';
import { getSession } from '../lib/neo4j/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function checkIndexState() {
  const session = getSession();

  try {
    const result = await session.run(`
      SHOW INDEXES
      YIELD name, type, state, populationPercent
      WHERE type = 'VECTOR'
      RETURN name, type, state, populationPercent
    `);

    console.log('Vector indices state:');
    for (const record of result.records) {
      const name = record.get('name');
      const state = record.get('state');
      const percent = record.get('populationPercent');
      console.log(`  - ${name}: ${state} (${percent}% populated)`);
    }

    if (result.records.length === 0) {
      console.log('  (no vector indices found)');
    }
  } finally {
    await session.close();
  }
}

checkIndexState()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
