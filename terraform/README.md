# Terraform Deployment for Cloud Run

This directory contains Terraform configuration to deploy the YouTube Graph application to Google Cloud Run.

## Prerequisites

1. **Google Cloud SDK** - Install from [cloud.google.com/sdk](https://cloud.google.com/sdk)
2. **Terraform** - Install from [terraform.io](https://terraform.io)
3. **Docker** - For building and pushing images
4. **GCP Project** - With billing enabled
5. **Neo4j Database** - Remote Neo4j instance (e.g., Neo4j Aura)

## Initial Setup

### 1. Authenticate with GCP

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 3. Initialize Terraform

```bash
terraform init
```

## Deployment Steps

### Step 1: Build and Push Docker Image

From the project root directory:

```bash
# Set your GCP project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export REPO_NAME="youtube-graph"
export IMAGE_NAME="youtube-graph-app"

# Configure Docker for GCP Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build the Docker image
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest .

# Note: You need to create the Artifact Registry first with Terraform
# Run: terraform apply -target=google_artifact_registry_repository.docker_repo

# Push the image
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest
```

### Step 2: Deploy Infrastructure

```bash
cd terraform

# Preview changes
terraform plan

# Apply changes
terraform apply
```

### Step 3: Get Service URL

```bash
terraform output service_url
```

## Architecture

### Resources Created

- **Cloud Run Service** - Serverless container hosting
- **Artifact Registry** - Docker image storage
- **Secret Manager** - Secure storage for API keys and passwords
- **IAM Policies** - Service permissions

### Environment Variables

All sensitive values are stored in Secret Manager:
- `NEO4J_PASSWORD`
- `GOOGLE_API_KEY`
- `ANTHROPIC_API_KEY`

Non-sensitive config is passed as environment variables.

### Scaling Configuration

- **Min instances**: 0 (scale-to-zero for cost savings)
- **Max instances**: 10 (adjust based on expected traffic)
- **CPU**: 1 vCPU
- **Memory**: 512MB (adjust if needed)

### Health Checks

- **Startup probe**: `/api/health` - Verifies container is ready
- **Liveness probe**: `/api/health` - Monitors container health

## Cost Optimization

### Scale-to-Zero
Set `min_instances = 0` in terraform.tfvars to scale to zero when idle.

**Pros**: Minimal cost during low traffic
**Cons**: Cold start delays (1-3s) after idle periods

### Always-On
Set `min_instances = 1` for faster response times.

**Pros**: No cold starts
**Cons**: ~$25-50/month base cost

## Updating the Application

### 1. Build and Push New Image

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:v2 .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:v2
```

### 2. Update terraform.tfvars

```bash
image_tag = "v2"
```

### 3. Apply Changes

```bash
terraform apply
```

## Managing Secrets

### Update a Secret

```bash
# Using gcloud
echo -n "new-password" | gcloud secrets versions add neo4j-password --data-file=-

# Or update terraform.tfvars and re-apply
terraform apply
```

## Monitoring

### View Logs

```bash
gcloud run services logs read youtube-graph --region=us-central1
```

### View Metrics

```bash
# In GCP Console
# Cloud Run > youtube-graph > Metrics
```

## Troubleshooting

### Cold Starts Too Slow
- Increase `min_instances` to 1
- Optimize Docker image size
- Use startup_cpu_boost (already enabled)

### Out of Memory
- Increase `memory_limit` in terraform.tfvars
- Monitor memory usage in Cloud Run metrics

### Container Fails to Start
- Check logs: `gcloud run services logs read youtube-graph`
- Verify health check endpoint is responding
- Check environment variables are set correctly

### Neo4j Connection Issues
- Verify Neo4j URI is correct
- Check firewall rules allow GCP IP ranges
- Verify credentials in Secret Manager

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete the Cloud Run service, secrets, and Artifact Registry.

## Security Best Practices

1. **Never commit `terraform.tfvars`** - Contains sensitive data
2. **Use Secret Manager** - For all API keys and passwords
3. **Enable VPC Connector** (optional) - For private Neo4j access
4. **Set `allow_public_access = false`** - If not needed
5. **Use IAM** - For authenticated access only

## Cost Estimation

With default settings (scale-to-zero):
- **Idle**: ~$0/month (pay only for Secret Manager storage)
- **Light usage** (1000 requests/day): ~$5-10/month
- **Moderate usage** (10,000 requests/day): ~$20-40/month

Prices depend on:
- Request count
- CPU time per request
- Memory allocation
- Network egress

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
