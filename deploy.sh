#!/bin/bash

# Deployment script for YouTube Graph to Google Cloud Run
# Usage: ./deploy.sh [tag]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}YouTube Graph Cloud Run Deployment${NC}"
echo "=================================="

# Check if terraform.tfvars exists
if [ ! -f "$SCRIPT_DIR/terraform/terraform.tfvars" ]; then
    echo -e "${RED}Error: terraform/terraform.tfvars not found${NC}"
    echo "Please create it from terraform.tfvars.example"
    exit 1
fi

# Load project configuration from terraform.tfvars
PROJECT_ID=$(grep '^project_id' terraform/terraform.tfvars | cut -d'"' -f2)
REGION=$(grep '^region' terraform/terraform.tfvars | cut -d'"' -f2)
REPO_NAME=$(grep '^artifact_registry_repo_name' terraform/terraform.tfvars | cut -d'"' -f2)
IMAGE_NAME=$(grep '^image_name' terraform/terraform.tfvars | cut -d'"' -f2)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Could not read project_id from terraform.tfvars${NC}"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Repository: $REPO_NAME"
echo "  Image: $IMAGE_NAME"
echo "  Tag: $TAG"
echo ""

# Step 1: Check if logged in to gcloud
echo -e "${YELLOW}Step 1: Checking GCP authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}Not authenticated with gcloud. Running 'gcloud auth login'...${NC}"
    gcloud auth login
fi

# Set project
gcloud config set project "$PROJECT_ID"

# Step 2: Create Artifact Registry (if needed)
echo -e "${YELLOW}Step 2: Ensuring Artifact Registry exists...${NC}"
cd "$SCRIPT_DIR/terraform"
if ! terraform state show google_artifact_registry_repository.docker_repo > /dev/null 2>&1; then
    echo "Creating Artifact Registry repository..."
    terraform init
    terraform apply -target=google_artifact_registry_repository.docker_repo -auto-approve
else
    echo "Artifact Registry already exists."
fi
cd "$SCRIPT_DIR"

# Step 3: Configure Docker for Artifact Registry
echo -e "${YELLOW}Step 3: Configuring Docker authentication...${NC}"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Step 4: Build Docker image
echo -e "${YELLOW}Step 4: Building Docker image...${NC}"
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"
docker build -t "$IMAGE_URL" .

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker build failed${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful!${NC}"

# Step 5: Push Docker image
echo -e "${YELLOW}Step 5: Pushing Docker image...${NC}"
docker push "$IMAGE_URL"

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker push failed${NC}"
    exit 1
fi

echo -e "${GREEN}Push successful!${NC}"

# Step 6: Deploy with Terraform
echo -e "${YELLOW}Step 6: Deploying to Cloud Run with Terraform...${NC}"
cd "$SCRIPT_DIR/terraform"

# Update image_tag if not default
if [ "$TAG" != "latest" ]; then
    export TF_VAR_image_tag="$TAG"
fi

terraform init
terraform apply

if [ $? -ne 0 ]; then
    echo -e "${RED}Terraform deployment failed${NC}"
    exit 1
fi

# Step 7: Get service URL
echo ""
echo -e "${GREEN}Deployment successful!${NC}"
echo ""
SERVICE_URL=$(terraform output -raw service_url 2>/dev/null || echo "")
if [ -n "$SERVICE_URL" ]; then
    echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"
else
    echo -e "${YELLOW}Getting service URL...${NC}"
    gcloud run services describe youtube-graph --region="$REGION" --format="value(status.url)"
fi

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
