#!/bin/bash

# Cloud Function Deployment Script
echo "🚀 Deploying Cloud Function for video upload handling..."

# Set variables
FUNCTION_NAME="upload-video"
REGION="us-central1"
RUNTIME="nodejs22"
TRIGGER="http"
MEMORY="512MB"
TIMEOUT="540s"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy the function
echo "🌐 Deploying Cloud Function..."
gcloud functions deploy $FUNCTION_NAME \
  --runtime $RUNTIME \
  --trigger-$TRIGGER \
  --allow-unauthenticated \
  --memory $MEMORY \
  --timeout $TIMEOUT \
  --region $REGION \
  --set-env-vars UPLOAD_BUCKET=ai-debate-uploads,CLOUD_RUN_URL=https://processdebatevideo-ai-human-api-system.us-central1.run.app/processDebateVideo

# Get the function URL
echo "🔗 Getting function URL..."
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --format="value(httpsTrigger.url)")

echo "✅ Cloud Function deployed successfully!"
echo "📋 Function URL: $FUNCTION_URL"
echo ""
echo "📝 Next steps:"
echo "1. Update the uploadUrl in web-upload/upload.js with: $FUNCTION_URL"
echo "2. Test the upload functionality"
echo "3. Deploy the web interface" 