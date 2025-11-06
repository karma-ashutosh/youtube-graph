import { findFuzzyMatch } from "../lib/utils/fuzzy-match";
import { Concept } from "../lib/types";
import * as fs from "fs";

interface SegmentData {
  analysis_json: any;
}

function testFuzzyMatching() {
  console.log("🔍 Testing Fuzzy Matching on micro_saas.json\n");

  // Load micro_saas.json
  const data = JSON.parse(fs.readFileSync("micro_saas.json", "utf-8")) as SegmentData[];
  console.log(`📄 Loaded ${data.length} segments from micro_saas.json\n`);

  // Extract all concept names
  const conceptNames: string[] = [];
  for (const segment of data) {
    const analysis = typeof segment.analysis_json === "string"
      ? JSON.parse(segment.analysis_json)
      : segment.analysis_json;

    if (analysis.primary_concept?.name) {
      conceptNames.push(analysis.primary_concept.name);
    }
    if (analysis.supporting_concepts) {
      for (const c of analysis.supporting_concepts) {
        conceptNames.push(c.name);
      }
    }
    if (analysis.mentioned_concepts) {
      for (const c of analysis.mentioned_concepts) {
        conceptNames.push(c.name);
      }
    }
    if (analysis.examples) {
      for (const e of analysis.examples) {
        conceptNames.push(e.concept_illustrated);
      }
    }
  }

  console.log(`🎯 Found ${conceptNames.length} total concept references\n`);
  console.log("─".repeat(80));

  // Test fuzzy matching (simulate incremental concept building)
  let fuzzyMatchCount = 0;
  let llmCallCount = 0;
  const fuzzyMatches: Array<{name: string, match: string}> = [];
  const llmCalls: string[] = [];
  const knownConcepts: Concept[] = [];

  for (const name of conceptNames) {
    const match = findFuzzyMatch(name, knownConcepts, 0.85);
    if (match) {
      fuzzyMatchCount++;
      fuzzyMatches.push({ name, match: match.canonical_name });
    } else {
      llmCallCount++;
      llmCalls.push(name);

      // Simulate adding this as a new concept (like LLM would create)
      const newConcept: Concept = {
        concept_id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        canonical_name: name,
        aliases: [],
        category: "General",
        first_mentioned: new Date(),
        last_mentioned: new Date(),
        total_mentions: 1,
        importance_score: 0
      };
      knownConcepts.push(newConcept);
    }
  }

  // Print results
  console.log("\n📊 FUZZY MATCH RESULTS\n");
  console.log(`✅ Fuzzy Matches: ${fuzzyMatchCount} / ${conceptNames.length} (${((fuzzyMatchCount / conceptNames.length) * 100).toFixed(1)}%)`);
  console.log(`⚡ LLM Calls Needed: ${llmCallCount} / ${conceptNames.length} (${((llmCallCount / conceptNames.length) * 100).toFixed(1)}%)`);
  console.log(`🎯 Unique Concepts Created: ${knownConcepts.length}`);
  console.log("─".repeat(80));

  // Show sample matches
  console.log("\n✅ Sample Fuzzy Matches (first 20):\n");
  for (const {name, match} of fuzzyMatches.slice(0, 20)) {
    if (name !== match) {
      console.log(`  "${name}" → "${match}"`);
    } else {
      console.log(`  "${name}" (exact match)`);
    }
  }

  // Show unique LLM calls that would be needed
  console.log("\n⚡ Unique Concepts Requiring LLM Calls:\n");
  const uniqueLLMCalls = [...new Set(llmCalls)];
  for (const name of uniqueLLMCalls.slice(0, 30)) {
    console.log(`  - ${name}`);
  }
  if (uniqueLLMCalls.length > 30) {
    console.log(`  ... and ${uniqueLLMCalls.length - 30} more`);
  }

  console.log("\n" + "─".repeat(80));
  console.log("\n💡 SUMMARY:");
  console.log(`   📊 Total concept references: ${conceptNames.length}`);
  console.log(`   ✅ Fuzzy matched (no LLM): ${fuzzyMatchCount} (${((fuzzyMatchCount / conceptNames.length) * 100).toFixed(1)}%)`);
  console.log(`   ⚡ LLM calls required: ${uniqueLLMCalls.length} (unique concepts)`);
  console.log(`   🎯 Total unique concepts: ${knownConcepts.length}`);
  console.log(`\n   💰 LLM Cost Savings: ${((fuzzyMatchCount / conceptNames.length) * 100).toFixed(1)}% reduction in API calls`);

  process.exit(0);
}

testFuzzyMatching();
