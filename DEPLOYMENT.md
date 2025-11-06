# Cloud Run Deployment Guide

Quick guide to deploy YouTube Graph to Google Cloud Run using the automated deployment setup.

## Quick Start

### 1. Prerequisites

```bash
# Install required tools
# - gcloud CLI: https://cloud.google.com/sdk/docs/install
# - Terraform: https://terraform.io
# - Docker: https://docker.com

# Verify installations
gcloud --version
terraform --version
docker --version
```

### 2. Configure GCP

```bash
# Login to GCP
gcloud auth login
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable billing (required for Cloud Run)
# Visit: https://console.cloud.google.com/billing
```

### 3. Configure Deployment

```bash
# Copy and edit terraform variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # or use your preferred editor
```

**Required values in terraform.tfvars:**
```hcl
project_id     = "your-gcp-project-id"
neo4j_uri      = "neo4j+s://xxxxx.databases.neo4j.io"
neo4j_password = "your-neo4j-password"
google_api_key = "your-google-api-key"
```

### 4. Deploy

```bash
# From project root, run the deployment script
./deploy.sh

# Or with a specific version tag
./deploy.sh v1.0.0
```

The script will:
1. ✅ Verify GCP authentication
2. ✅ Create Artifact Registry
3. ✅ Build Docker image
4. ✅ Push to Artifact Registry
5. ✅ Deploy to Cloud Run
6. ✅ Display service URL

### 5. Access Your Application

After deployment completes, you'll see:
```
Service URL: https://youtube-graph-xxxxx-uc.a.run.app
```

Visit this URL to access your deployed application!

## Manual Deployment

If you prefer manual control:

### Build and Push Image

```bash
# Set variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Configure Docker
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/youtube-graph/youtube-graph-app:latest .

# Push
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/youtube-graph/youtube-graph-app:latest
```

### Deploy with Terraform

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

## Cost Optimization

### Scale-to-Zero (Recommended)
In `terraform.tfvars`:
```hcl
min_instances = 0  # Scale to zero when idle
```

**Monthly cost**: ~$0-10 for low traffic
**Trade-off**: 1-3 second cold start after idle

### Always-On
```hcl
min_instances = 1  # Always have 1 instance running
```

**Monthly cost**: ~$25-50 base cost
**Trade-off**: No cold starts

## Updating Your Application

### Update Code and Redeploy

```bash
# Make your code changes
git add .
git commit -m "Update feature X"

# Deploy new version
./deploy.sh v1.0.1
```

### Update Environment Variables

Edit `terraform/terraform.tfvars` and re-run:
```bash
./deploy.sh
```

### Update Secrets

```bash
# Option 1: Update terraform.tfvars and redeploy
./deploy.sh

# Option 2: Update directly in GCP
echo -n "new-password" | gcloud secrets versions add neo4j-password --data-file=-
```

## Monitoring

### View Logs

```bash
# Real-time logs
gcloud run services logs tail youtube-graph --region=us-central1

# Recent logs
gcloud run services logs read youtube-graph --region=us-central1 --limit=50
```

### View Metrics

Visit GCP Console:
- **URL**: https://console.cloud.google.com/run
- Navigate to: Cloud Run > youtube-graph > Metrics

Key metrics:
- Request count
- Request latency
- Container CPU/Memory usage
- Instance count

## Troubleshooting

### Issue: Cold starts are too slow

**Solution 1**: Increase min_instances
```hcl
min_instances = 1
```

**Solution 2**: Optimize Docker image
- Use multi-stage builds (already done ✅)
- Minimize dependencies
- Use Next.js standalone output (already done ✅)

### Issue: Out of memory errors

**Solution**: Increase memory limit
```hcl
memory_limit = "1Gi"  # or "2Gi"
```

Then redeploy:
```bash
./deploy.sh
```

### Issue: Cannot connect to Neo4j

**Checklist**:
1. ✅ Neo4j URI is correct (check terraform.tfvars)
2. ✅ Neo4j firewall allows GCP IP ranges
3. ✅ Credentials are correct in Secret Manager
4. ✅ Neo4j database is online

**Debug**:
```bash
# Check logs for connection errors
gcloud run services logs read youtube-graph --region=us-central1 | grep -i neo4j
```

### Issue: Build fails

**Common causes**:
1. Missing dependencies in package.json
2. TypeScript errors
3. Environment variables needed at build time

**Solution**: Test build locally first
```bash
npm install
npm run build
```

### Issue: Deployment fails

**Check**:
```bash
# Verify GCP permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID

# Check if APIs are enabled
gcloud services list --enabled
```

**Required APIs**:
- Cloud Run API
- Artifact Registry API
- Secret Manager API

## Rollback

### Rollback to Previous Version

```bash
cd terraform

# Specify previous image tag
export TF_VAR_image_tag="v1.0.0"
terraform apply
```

### Emergency Rollback via Console

1. Visit Cloud Run console
2. Click your service name
3. Go to "Revisions" tab
4. Select previous working revision
5. Click "Manage Traffic"
6. Route 100% traffic to previous revision

## Cleanup

To delete all Cloud Run resources:

```bash
cd terraform
terraform destroy
```

**Warning**: This will delete:
- Cloud Run service
- Artifact Registry and images
- All secrets in Secret Manager

## Architecture Summary

```
┌─────────────────┐
│   User Request  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Cloud Run     │
│  (Container)    │
│                 │
│  - Next.js App  │
│  - Port 8080    │
│  - Auto-scale   │
└────────┬────────┘
         │
         ├─────────► Neo4j (Remote)
         │
         └─────────► Google AI / Anthropic
```

## Cost Estimate

**Low traffic** (1,000 requests/day):
- Compute: ~$3-5/month
- Secret Manager: ~$0.50/month
- Total: ~$5-10/month

**Moderate traffic** (10,000 requests/day):
- Compute: ~$15-30/month
- Secret Manager: ~$0.50/month
- Total: ~$20-40/month

**Always-on** (min_instances = 1):
- Base: ~$25-50/month
- Plus per-request costs

## Security Checklist

- ✅ Secrets stored in Secret Manager
- ✅ Service runs as non-root user
- ✅ HTTPS enforced by default
- ✅ IAM roles for service accounts
- ⚠️ Public access enabled (change if needed)

To disable public access:
```hcl
allow_public_access = false
```

## Additional Resources

- [Terraform Config](./terraform/README.md) - Detailed Terraform documentation
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Next.js Docker](https://nextjs.org/docs/deployment#docker-image)

## Support

For issues with:
- **Deployment script**: Check deploy.sh logs
- **Terraform**: See terraform/README.md
- **Application**: Check Cloud Run logs
- **This guide**: Open an issue or PR
