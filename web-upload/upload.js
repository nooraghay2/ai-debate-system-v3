class VideoUploader {
    constructor() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('videoFile');
        this.submitBtn = document.getElementById('submitBtn');
        this.progressSection = document.getElementById('progressSection');
        this.resultSection = document.getElementById('resultSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        this.selectedFile = null;
        // This URL will be updated when we deploy the Cloud Function
        this.uploadUrl = 'https://us-central1-ai-human-api-system.cloudfunctions.net/upload-video';
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files[0]);
        });

        // Submit button
        this.submitBtn.addEventListener('click', () => {
            this.uploadVideo();
        });
    }

    handleFileSelect(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file.');
            return;
        }

        // Validate file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB in bytes
        if (file.size > maxSize) {
            alert('File size must be less than 100MB.');
            return;
        }

        this.selectedFile = file;
        this.uploadArea.classList.add('has-file');
        this.uploadArea.classList.remove('dragover');
        
        // Update upload area content
        const uploadContent = this.uploadArea.querySelector('.upload-content');
        uploadContent.innerHTML = `
            <div class="upload-icon">✅</div>
            <h3>File Selected</h3>
            <p><strong>${file.name}</strong></p>
            <p>Size: ${this.formatFileSize(file.size)}</p>
            <button class="upload-btn" onclick="document.getElementById('videoFile').click()">
                Choose Different File
            </button>
        `;

        this.updateSubmitButton();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateSubmitButton() {
        const email = document.getElementById('userEmail').value.trim();
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        
        this.submitBtn.disabled = !(this.selectedFile && isValidEmail);
    }

    async uploadVideo() {
        if (!this.selectedFile) return;

        const email = document.getElementById('userEmail').value.trim();
        const topic = document.getElementById('debateTopic').value.trim();

        // Show progress
        this.progressSection.style.display = 'block';
        this.submitBtn.disabled = true;

        try {
            // Convert file to base64
            this.updateProgress(10, 'Converting file to base64...');
            const base64 = await this.fileToBase64(this.selectedFile);
            
            this.updateProgress(30, 'Preparing upload...');
            
            // Create JSON payload
            const payload = {
                videoData: base64,
                fileName: this.selectedFile.name,
                fileType: this.selectedFile.type,
                fileSize: this.selectedFile.size,
                email: email,
                topic: topic
            };

            this.updateProgress(50, 'Uploading to server...');

            // Upload to Cloud Function
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                mode: 'cors',
                credentials: 'omit'
            });

            this.updateProgress(90, 'Processing...');

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.updateProgress(100, 'Upload successful!');
                setTimeout(() => this.showSuccess(), 500);
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            alert(`Upload failed: ${error.message}`);
            this.hideProgress();
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // Remove data URL prefix
                resolve(base64);
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(file);
        });
    }



    showSuccess() {
        this.progressSection.style.display = 'none';
        this.resultSection.style.display = 'block';
        
        // Scroll to result
        this.resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    hideProgress() {
        this.progressSection.style.display = 'none';
        this.submitBtn.disabled = false;
    }

    updateProgress(percent, text) {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = text;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const uploader = new VideoUploader();
    
    // Add email validation
    document.getElementById('userEmail').addEventListener('input', () => {
        uploader.updateSubmitButton();
    });
}); 