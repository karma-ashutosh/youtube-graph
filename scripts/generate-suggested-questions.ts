import neo4j from 'neo4j-driver';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: '.env' });

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface ConceptData {
  canonical_name: string;
  category: string;
  total_mentions: number;
  primary_count: number;
}

interface WorkspaceSummary {
  workspace: string;
  totalConcepts: number;
  totalSegments: number;
  topConcepts: ConceptData[];
  topCategories: string[];
  suggestedQuestions: string[];
  summary: string;
}

/**
 * Get top concepts for a workspace
 */
async function getTopConcepts(workspace: string, limit: number = 15): Promise<ConceptData[]> {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (c:Concept {workspace: $workspace})
      OPTIONAL MATCH (s:Segment {workspace: $workspace})-[d:DISCUSSES]->(c)
      WITH c,
           count(DISTINCT CASE WHEN d.role = 'primary' THEN s END) as primary_count
      WHERE c.total_mentions >= 1
      RETURN c.canonical_name as canonical_name,
             c.category as category,
             c.total_mentions as total_mentions,
             primary_count
      ORDER BY c.total_mentions DESC, primary_count DESC
      LIMIT $limit
    `, { workspace, limit: neo4j.int(limit) });

    return result.records.map((record) => ({
      canonical_name: record.get('canonical_name'),
      category: record.get('category') || 'Uncategorized',
      total_mentions: neo4j.isInt(record.get('total_mentions'))
        ? record.get('total_mentions').toNumber()
        : record.get('total_mentions') || 0,
      primary_count: neo4j.isInt(record.get('primary_count'))
        ? record.get('primary_count').toNumber()
        : record.get('primary_count') || 0,
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get top categories for a workspace
 */
async function getTopCategories(workspace: string, limit: number = 5): Promise<string[]> {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (c:Concept {workspace: $workspace})
      WHERE c.category IS NOT NULL AND c.category <> 'Uncategorized'
      RETURN c.category as category, count(c) as count
      ORDER BY count DESC
      LIMIT $limit
    `, { workspace, limit: neo4j.int(limit) });

    return result.records.map((record) => record.get('category'));
  } finally {
    await session.close();
  }
}

/**
 * Get total counts for a workspace
 */
async function getWorkspaceCounts(workspace: string): Promise<{ concepts: number; segments: number }> {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (c:Concept {workspace: $workspace})
      WITH count(c) as concept_count
      MATCH (s:Segment {workspace: $workspace})
      RETURN concept_count, count(s) as segment_count
    `, { workspace });

    if (result.records.length === 0) {
      return { concepts: 0, segments: 0 };
    }

    const record = result.records[0];
    return {
      concepts: neo4j.isInt(record.get('concept_count'))
        ? record.get('concept_count').toNumber()
        : record.get('concept_count') || 0,
      segments: neo4j.isInt(record.get('segment_count'))
        ? record.get('segment_count').toNumber()
        : record.get('segment_count') || 0,
    };
  } finally {
    await session.close();
  }
}

/**
 * Generate suggested questions using Claude based on top concepts (or fallback to rule-based)
 */
async function generateSuggestedQuestions(
  topConcepts: ConceptData[],
  topCategories: string[]
): Promise<{ questions: string[]; summary: string }> {
  // If no API key or no concepts, use fallback
  if (!anthropic || topConcepts.length === 0) {
    return generateFallbackQuestions(topConcepts, topCategories);
  }

  // Format concepts for the prompt
  const conceptList = topConcepts
    .slice(0, 10)
    .map((c, i) => `${i + 1}. ${c.canonical_name} (${c.category}, ${c.total_mentions} mentions)`)
    .join('\n');

  const categoriesList = topCategories.join(', ');

  const prompt = `You are analyzing a knowledge graph built from video content. Based on the following information, generate 3 engaging questions that users might want to ask.

Top concepts discussed (by importance):
${conceptList}

Main categories: ${categoriesList}

Generate exactly 3 questions that:
1. Are specific and actionable (not too broad like "tell me about X")
2. Cover different concepts or themes from the list
3. Would lead to interesting, informative answers
4. Are phrased naturally as questions someone would actually ask
5. Are concise (max 10-12 words each)

Also provide a brief 1-sentence summary of what this knowledge base covers.

Return your response in this exact JSON format:
{
  "questions": ["question 1", "question 2", "question 3"],
  "summary": "one sentence summary"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : '{}';

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    return {
      questions: parsed.questions || [],
      summary: parsed.summary || 'Explore knowledge from video content',
    };
  } catch (error) {
    console.error('Error generating questions with AI, using fallback:', error);
    return generateFallbackQuestions(topConcepts, topCategories);
  }
}

/**
 * Generate questions using rule-based approach (fallback when API is unavailable)
 */
function generateFallbackQuestions(
  topConcepts: ConceptData[],
  topCategories: string[]
): { questions: string[]; summary: string } {
  if (topConcepts.length === 0) {
    return {
      questions: [
        'What topics are covered in this knowledge base?',
        'How can I get started?',
        'What are the most important concepts?',
      ],
      summary: 'Explore knowledge from video content',
    };
  }

  // Generate questions based on top concepts
  const questions: string[] = [];

  // Question templates for variety
  const templates = [
    (concept: string) => `How do I apply ${concept} effectively?`,
    (concept: string) => `What are the key principles of ${concept}?`,
    (concept: string) => `How does ${concept} work in practice?`,
    (concept: string) => `What should I know about ${concept}?`,
    (concept: string) => `How can I implement ${concept}?`,
  ];

  // Pick up to 3 top concepts and generate questions
  for (let i = 0; i < Math.min(3, topConcepts.length); i++) {
    const concept = topConcepts[i].canonical_name;
    const template = templates[i % templates.length];
    questions.push(template(concept));
  }

  // Generate summary based on categories or top concepts
  let summary = 'Explore knowledge from video content';
  if (topCategories.length > 0) {
    const categories = topCategories.slice(0, 2).join(' and ');
    summary = `Learn about ${categories} and related topics`;
  } else if (topConcepts.length > 0) {
    const concepts = topConcepts.slice(0, 2).map(c => c.canonical_name).join(' and ');
    summary = `Discover insights about ${concepts} and more`;
  }

  return { questions, summary };
}

/**
 * Generate content for a single workspace
 */
async function generateWorkspaceContent(workspace: string): Promise<WorkspaceSummary> {
  console.log(`\n📊 Processing workspace: ${workspace}`);

  const counts = await getWorkspaceCounts(workspace);
  console.log(`  - ${counts.concepts} concepts, ${counts.segments} segments`);

  const topConcepts = await getTopConcepts(workspace);
  console.log(`  - Found ${topConcepts.length} top concepts`);

  const topCategories = await getTopCategories(workspace);
  console.log(`  - Found ${topCategories.length} top categories`);

  const { questions, summary } = await generateSuggestedQuestions(topConcepts, topCategories);
  console.log(`  - Generated ${questions.length} questions`);

  return {
    workspace,
    totalConcepts: counts.concepts,
    totalSegments: counts.segments,
    topConcepts,
    topCategories,
    suggestedQuestions: questions,
    summary,
  };
}

/**
 * Get all workspaces
 */
async function getAllWorkspaces(): Promise<string[]> {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (s:Segment)
      RETURN DISTINCT s.workspace as workspace
      ORDER BY workspace
    `);

    return result.records.map((record) => record.get('workspace'));
  } finally {
    await session.close();
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting suggested questions generator...\n');

  try {
    // Get all workspaces
    const workspaces = await getAllWorkspaces();
    console.log(`Found ${workspaces.length} workspace(s): ${workspaces.join(', ')}`);

    // Generate content for each workspace
    const workspaceData: Record<string, WorkspaceSummary> = {};

    for (const workspace of workspaces) {
      const data = await generateWorkspaceContent(workspace);
      workspaceData[workspace] = data;
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'lib', 'data');
    await fs.mkdir(outputDir, { recursive: true });

    // Write the data to a JSON file
    const outputPath = path.join(outputDir, 'suggested-questions.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify(workspaceData, null, 2),
      'utf-8'
    );

    console.log(`\n✅ Successfully generated suggested questions!`);
    console.log(`📝 Output written to: ${outputPath}`);

    // Print summary
    console.log('\n📊 Summary:');
    for (const [workspace, data] of Object.entries(workspaceData)) {
      console.log(`\n${workspace}:`);
      console.log(`  Summary: ${data.summary}`);
      console.log(`  Questions:`);
      data.suggestedQuestions.forEach((q, i) => {
        console.log(`    ${i + 1}. ${q}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
