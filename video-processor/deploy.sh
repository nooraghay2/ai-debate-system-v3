#!/bin/bash

# AI Debate Video Processor Deployment Script

set -e

# Configuration
PROJECT_ID="ai-human-api-system"
SERVICE_NAME="ai-debate-video-processor"
REGION="us-central1"
BUCKET_NAME="ai-debate-uploads"

echo "🚀 Deploying AI Debate Video Processor..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run 'gcloud auth login' first."
    exit 1
fi

# Set the project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Build and deploy to Cloud Run
echo "🏗️ Building and deploying to Cloud Run..."

gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 3600 \
    --concurrency 10 \
    --max-instances 5 \
    --set-env-vars "UPLOAD_BUCKET=$BUCKET_NAME" \
    --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
    --set-env-vars "NODE_ENV=production"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 Health check: $SERVICE_URL/"

# Update the Cloud Function to use the new service URL
echo "🔄 Updating Cloud Function with new service URL..."

# Set the environment variable for the Cloud Function
gcloud functions deploy upload-video \
    --region $REGION \
    --set-env-vars "CLOUD_RUN_URL=$SERVICE_URL/processDebateVideo" \
    --quiet

echo "✅ Cloud Function updated with new video processor URL!"

echo ""
echo "🎉 AI Debate Video Processor is now deployed and ready!"
echo ""
echo "📋 Service Details:"
echo "   - Service Name: $SERVICE_NAME"
echo "   - Region: $REGION"
echo "   - URL: $SERVICE_URL"
echo "   - Processing Endpoint: $SERVICE_URL/processDebateVideo"
echo ""
echo "🔧 Next Steps:"
echo "   1. Set your GEMINI_API_KEY environment variable"
echo "   2. Test the upload and processing workflow"
echo "   3. Monitor the service logs for any issues"
echo ""
echo "📝 To view logs:"
echo "   gcloud logs tail --service=$SERVICE_NAME --region=$REGION" 