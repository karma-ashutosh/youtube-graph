#!/bin/bash

# Script to completely reset Neo4j database
# This removes all data, constraints, and indexes

echo "========================================="
echo "Neo4j Complete Reset Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Neo4j connection details
CONTAINER_NAME="youtube-graph-neo4j"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="password123"

# Function to run cypher query
run_cypher() {
    docker exec $CONTAINER_NAME cypher-shell -u $NEO4J_USER -p $NEO4J_PASSWORD "$1"
}

echo -e "${YELLOW}Step 1: Checking if Neo4j container is running...${NC}"
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${RED}Error: Neo4j container '$CONTAINER_NAME' is not running${NC}"
    echo "Start it with: docker-compose up -d"
    exit 1
fi
echo -e "${GREEN}✓ Container is running${NC}"
echo ""

echo -e "${YELLOW}Step 2: Counting current nodes...${NC}"
NODE_COUNT=$(run_cypher "MATCH (n) RETURN count(n) as total_nodes;" | grep -E '^[0-9]+$' | head -1)
echo "Current nodes: $NODE_COUNT"
echo ""

echo -e "${YELLOW}Step 3: Deleting all nodes and relationships...${NC}"
run_cypher "MATCH (n) DETACH DELETE n;"
echo -e "${GREEN}✓ All data deleted${NC}"
echo ""

echo -e "${YELLOW}Step 4: Dropping all constraints...${NC}"
# Get all constraints and drop them
CONSTRAINTS=$(run_cypher "SHOW CONSTRAINTS;" 2>/dev/null | grep -v "^name" | grep -v "^$" | awk '{print $1}' || echo "")

if [ -z "$CONSTRAINTS" ]; then
    echo "No constraints found"
else
    while IFS= read -r constraint_name; do
        if [ ! -z "$constraint_name" ]; then
            echo "Dropping constraint: $constraint_name"
            run_cypher "DROP CONSTRAINT $constraint_name IF EXISTS;" 2>/dev/null || true
        fi
    done <<< "$CONSTRAINTS"
fi
echo -e "${GREEN}✓ All constraints dropped${NC}"
echo ""

echo -e "${YELLOW}Step 5: Dropping all indexes...${NC}"
# Get all indexes and drop them
INDEXES=$(run_cypher "SHOW INDEXES;" 2>/dev/null | grep -v "^name" | grep -v "^$" | awk '{print $1}' || echo "")

if [ -z "$INDEXES" ]; then
    echo "No indexes found"
else
    while IFS= read -r index_name; do
        if [ ! -z "$index_name" ]; then
            echo "Dropping index: $index_name"
            run_cypher "DROP INDEX $index_name IF EXISTS;" 2>/dev/null || true
        fi
    done <<< "$INDEXES"
fi
echo -e "${GREEN}✓ All indexes dropped${NC}"
echo ""

echo -e "${YELLOW}Step 6: Recreating constraints...${NC}"
# Recreate the constraints that your app needs
run_cypher "CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE;" 2>/dev/null || true
run_cypher "CREATE CONSTRAINT video_id_unique IF NOT EXISTS FOR (v:Video) REQUIRE v.video_id IS UNIQUE;" 2>/dev/null || true
run_cypher "CREATE CONSTRAINT segment_id_unique IF NOT EXISTS FOR (s:Segment) REQUIRE s.segment_id IS UNIQUE;" 2>/dev/null || true
echo -e "${GREEN}✓ Constraints recreated${NC}"
echo ""

echo -e "${YELLOW}Step 7: Verifying reset...${NC}"
FINAL_COUNT=$(run_cypher "MATCH (n) RETURN count(n) as total_nodes;" | grep -E '^[0-9]+$' | head -1)
echo "Final node count: $FINAL_COUNT"

if [ "$FINAL_COUNT" = "0" ]; then
    echo -e "${GREEN}✓ Database is completely clean!${NC}"
else
    echo -e "${RED}Warning: Expected 0 nodes, found $FINAL_COUNT${NC}"
fi
echo ""

echo "========================================="
echo -e "${GREEN}Reset Complete!${NC}"
echo "========================================="
echo ""
echo "Database is now fresh and ready for new data."
echo "All IDs will start from the beginning."
echo ""
echo "To ingest new data, run:"
echo "  curl -X POST http://localhost:3000/api/segments/ingest \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d @your_data_file.json"
echo ""
