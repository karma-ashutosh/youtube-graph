variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "youtube-graph"
}

variable "artifact_registry_repo_name" {
  description = "Name of the Artifact Registry repository"
  type        = string
  default     = "youtube-graph"
}

variable "image_name" {
  description = "Name of the Docker image"
  type        = string
  default     = "youtube-graph-app"
}

variable "image_tag" {
  description = "Tag of the Docker image"
  type        = string
  default     = "latest"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cpu_limit" {
  description = "CPU limit for Cloud Run container"
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run container"
  type        = string
  default     = "512Mi"
}

variable "allow_public_access" {
  description = "Allow unauthenticated public access to the service"
  type        = bool
  default     = true
}

# Neo4j Configuration
variable "neo4j_uri" {
  description = "Neo4j connection URI (e.g., neo4j+s://xxxxx.databases.neo4j.io)"
  type        = string
}

variable "neo4j_user" {
  description = "Neo4j username"
  type        = string
  default     = "neo4j"
}

variable "neo4j_password" {
  description = "Neo4j password (will be stored in Secret Manager)"
  type        = string
  sensitive   = true
}

# AI Provider Configuration
variable "ai_provider" {
  description = "AI provider to use (claude or gemini)"
  type        = string
  default     = "gemini"
}

variable "google_api_key" {
  description = "Google Gemini API key (will be stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic Claude API key (will be stored in Secret Manager)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_model" {
  description = "Gemini model to use"
  type        = string
  default     = "gemini-2.5-flash"
}

# Optional Configuration
variable "clarity_project_id" {
  description = "Microsoft Clarity project ID for analytics"
  type        = string
  default     = ""
}

variable "chat_debug_mode" {
  description = "Enable chat debug mode"
  type        = string
  default     = "false"
}

variable "app_mode" {
  description = "App mode: internal or external"
  type        = string
  default     = "external"
}

# PostgreSQL Configuration
variable "pghost" {
  description = "PostgreSQL host"
  type        = string
}

variable "pgdatabase" {
  description = "PostgreSQL database name"
  type        = string
  default     = "neondb"
}

variable "pguser" {
  description = "PostgreSQL user"
  type        = string
  default     = "neondb_owner"
}

variable "pgpassword" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "pgsslmode" {
  description = "PostgreSQL SSL mode"
  type        = string
  default     = "require"
}

variable "pgchannelbinding" {
  description = "PostgreSQL channel binding"
  type        = string
  default     = "require"
}

variable "use_llm_normalization" {
  description = "Use LLM for concept normalization"
  type        = string
  default     = "false"
}
