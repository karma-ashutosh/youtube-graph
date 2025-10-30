// Input data types from existing database
export interface SegmentData {
  id: string | null;
  video_url: string;
  start_time: string; // "00:03:54"
  end_time: string; // "00:04:42"
  topic_hint: string;
  analysis_json: string; // JSON string, needs parsing
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AnalysisData {
  primary_concept: {
    name: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only" | "surface";
    explanation_type: "definition" | "case_study" | "how_to" | "comparison" | "metaphor" | "story";
  };
  supporting_concepts: Array<{
    name: string;
    role: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only" | "surface";
  }>;
  mentioned_concepts: Array<{
    name: string;
    context: string;
    coverage_depth: "comprehensive" | "partial" | "reference_only" | "surface";
  }>;
  key_ideas: Array<{
    idea: string;
    type: "fact" | "advice" | "insight" | "metric" | "opinion";
    is_novel: boolean;
    confidence: "high" | "medium" | "low";
  }>;
  examples: Array<{
    example_text: string;
    type: "real_company" | "personal_story" | "metaphor" | "hypothetical" | "data_point";
    concept_illustrated: string;
  }>;
}

// Neo4j node types
export interface Video {
  video_id: string;
  url: string;
  title?: string;
  channel?: string;
  upload_date?: Date;
  created_at: Date;
}

export interface Segment {
  segment_id: string;
  video_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  topic_hint: string;
  created_at: Date;
}

export interface Concept {
  concept_id: string; // slug: "product_market_fit"
  canonical_name: string; // "Product-Market Fit"
  aliases: string[]; // ["PMF", "Product Market Fit"]
  category: string; // "Product", "Marketing", etc.
  first_mentioned: Date;
  last_mentioned: Date;
  total_mentions: number;
  importance_score: number; // 0-1
}

export interface ConceptInstance {
  instance_id: string;
  concept_id: string;
  segment_id: string;
  explanation_type: string;
  coverage_depth: string;
  novelty_score: number; // 0-1
  is_canonical: boolean;
  created_at: Date;
}

export interface Example {
  example_id: string;
  example_text: string;
  example_type: string;
  company_name?: string; // extracted if real_company
  segment_id: string;
}

export interface KeyIdea {
  idea_id: string;
  idea_text: string;
  idea_type: string;
  is_novel: boolean;
  confidence: string;
  segment_id: string;
}

export interface Category {
  category_id: string;
  name: string;
  color: string; // hex color for visualization
}

// Concept normalization result
export interface NormalizedConcept {
  canonical_name: string;
  concept_id: string;
  is_new: boolean;
  matched_existing_id?: string;
  confidence: "high" | "medium" | "low";
}

// Graph data for visualization
export interface GraphNode {
  id: string;
  label: string;
  type: "concept" | "video" | "segment";
  mentions?: number;
  importance?: number;
  category?: string;
  duration?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
  strength?: number;
  role?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
