# 🤖 AI Debate Response System v3

A modern web-based AI debate response system that allows users to upload debate videos and receive AI-generated responses.

## 🌟 Features

- **Modern Web Interface** - Beautiful, responsive design with drag-and-drop upload
- **Direct Cloud Storage** - No Google Drive dependencies
- **AI-Powered Processing** - Uses Google's Gemini AI for intelligent responses
- **Real-time Progress** - Visual feedback during upload and processing
- **Email Notifications** - Automatic email delivery of processed videos

## 🚀 Live Demo

**Web Interface:** [https://nooraghay2.github.io/ai-debate-system-v3/](https://nooraghay2.github.io/ai-debate-system-v3/)

## 🏗️ Architecture

```
User → Web Interface → Cloud Function → Cloud Storage → Cloud Run → AI Processing → Email
```

## 📁 Project Structure

```
ai-debate-system-v3/
├── web-upload/              # Web interface files
│   ├── index.html          # Main HTML page
│   ├── styles.css          # CSS styling
│   ├── upload.js           # JavaScript functionality
│   └── package.json        # Web dependencies
├── cloud-functions/         # Google Cloud Functions
│   ├── upload-handler.js   # Video upload handler
│   ├── package.json        # Function dependencies
│   └── deploy.sh           # Deployment script
├── .github/workflows/      # GitHub Actions
│   ├── deploy.yml          # Google Cloud deployment
│   └── pages.yml           # GitHub Pages deployment
└── README.md               # This file
```

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Google Cloud Functions, Google Cloud Run
- **Storage:** Google Cloud Storage
- **AI:** Google Gemini AI
- **Deployment:** GitHub Actions, Google Cloud Platform

## 🚀 Quick Start

### Prerequisites

- Google Cloud Platform account
- Node.js 22+
- Google Cloud CLI

### 1. Clone the Repository

```bash
git clone https://github.com/nooraghay2/ai-debate-system-v3.git
cd ai-debate-system-v3
```

### 2. Set Up Google Cloud

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Create storage buckets
gsutil mb gs://ai-debate-uploads
gsutil mb gs://ai-debate-input
gsutil mb gs://ai-debate-output
```

### 3. Deploy Cloud Function

```bash
cd cloud-functions
npm install
./deploy.sh
```

### 4. Update Web Interface

Update the Cloud Function URL in `web-upload/upload.js`:

```javascript
this.uploadUrl = 'YOUR_CLOUD_FUNCTION_URL';
```

### 5. Deploy Web Interface

```bash
cd web-upload
gcloud run deploy debate-upload-web \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 🔧 Configuration

### Environment Variables

Set these in your Google Cloud project:

- `GEMINI_API_KEY` - Your Google Gemini API key
- `UPLOAD_BUCKET` - Cloud Storage bucket for uploads
- `INPUT_BUCKET` - Cloud Storage bucket for input files
- `OUTPUT_BUCKET` - Cloud Storage bucket for output files

### GitHub Secrets

For GitHub Actions deployment, set these secrets:

- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GCP_SA_KEY` - Google Cloud service account key

## 📱 Usage

1. **Visit the web interface**
2. **Drag and drop** a video file or click to browse
3. **Enter your email** address
4. **Optionally add** a debate topic
5. **Click "Process Video"**
6. **Wait for processing** (2-3 minutes)
7. **Check your email** for the download link

## 🔒 Security

- File size limit: 100MB
- Supported formats: MP4, MOV, AVI
- Email validation required
- CORS enabled for web interface
- Secure Cloud Storage access

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/nooraghay2/ai-debate-system-v3/issues) page
2. Create a new issue with detailed information
3. Include error messages and steps to reproduce

## 🔄 Updates

This project is actively maintained. Check the [Releases](https://github.com/nooraghay2/ai-debate-system-v3/releases) page for the latest updates.

---

**Made with ❤️ using Google Cloud Platform and AI technologies** 