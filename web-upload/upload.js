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
        console.log('File selected:', file);
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
            <button class="upload-btn" id="chooseDifferentFile">
                Choose Different File
            </button>
        `;
        
        // Add event listener to the new button
        document.getElementById('chooseDifferentFile').addEventListener('click', () => {
            this.fileInput.click();
        });

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
        
        const shouldEnable = this.selectedFile && isValidEmail;
        console.log('Update submit button:', {
            hasFile: !!this.selectedFile,
            isValidEmail: isValidEmail,
            shouldEnable: shouldEnable
        });
        
        this.submitBtn.disabled = !shouldEnable;
    }

    async uploadVideo() {
        console.log('Upload button clicked');
        console.log('Selected file:', this.selectedFile);
        
        if (!this.selectedFile) {
            alert('Please select a video file first.');
            return;
        }

        const email = document.getElementById('userEmail').value.trim();
        const topic = document.getElementById('debateTopic').value.trim();

        // Show progress
        this.progressSection.style.display = 'block';
        this.submitBtn.disabled = true;

        try {
            // Check if file is large enough to need chunked upload (over 50MB)
            const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
            
            if (this.selectedFile.size > LARGE_FILE_THRESHOLD) {
                // Use chunked upload for large files
                console.log('Large file detected, using chunked upload...');
                await this.uploadLargeFile(email, topic);
                return;
            }

            // For smaller files, use base64 upload
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

            console.log('Uploading file:', {
                name: this.selectedFile.name,
                size: this.selectedFile.size,
                base64Length: base64.length,
                payloadSize: JSON.stringify(payload).length
            });

            this.updateProgress(50, 'Uploading to server...');

            // Upload to Cloud Function with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                mode: 'cors',
                credentials: 'omit',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            this.updateProgress(90, 'Processing...');

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.updateProgress(100, 'Upload successful!');
                setTimeout(() => this.showSuccess(), 500);
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Base64 upload error:', error);
            
            // Try fallback to multipart upload
            if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
                this.updateProgress(50, 'Trying alternative upload method...');
                
                try {
                    await this.tryMultipartUpload(email, topic);
                    return;
                } catch (multipartError) {
                    console.error('Multipart upload also failed:', multipartError);
                    alert('Both upload methods failed. Please try again with a smaller file or check your connection.');
                }
            } else {
                alert(`Upload failed: ${error.message}`);
            }
            this.hideProgress();
        }
    }

    async uploadLargeFile(email, topic) {
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
        
        try {
            // Calculate number of chunks
            const totalChunks = Math.ceil(this.selectedFile.size / CHUNK_SIZE);
            console.log(`File size: ${this.selectedFile.size}, Chunk size: ${CHUNK_SIZE}, Total chunks: ${totalChunks}`);
            
            // Generate unique upload ID
            const uploadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            // Upload chunks
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, this.selectedFile.size);
                const chunk = this.selectedFile.slice(start, end);
                
                const progressPercent = 10 + ((chunkIndex + 1) / totalChunks) * 80; // 10% to 90%
                this.updateProgress(progressPercent, `Uploading chunk ${chunkIndex + 1} of ${totalChunks}...`);
                
                console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks}: ${start}-${end} bytes`);
                
                // Convert chunk to base64
                const chunkBase64 = await this.fileToBase64(chunk);
                
                // Upload chunk
                const chunkPayload = {
                    uploadId: uploadId,
                    chunkIndex: chunkIndex,
                    totalChunks: totalChunks,
                    chunkData: chunkBase64,
                    fileName: this.selectedFile.name,
                    fileType: this.selectedFile.type,
                    fileSize: this.selectedFile.size,
                    email: email,
                    topic: topic,
                    isLastChunk: chunkIndex === totalChunks - 1
                };
                
                const response = await fetch(this.uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(chunkPayload)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Chunk ${chunkIndex + 1} upload failed: ${response.status} - ${errorText}`);
                }
                
                const result = await response.json();
                console.log(`Chunk ${chunkIndex + 1} result:`, result);
                
                if (result.success && result.isLastChunk) {
                    this.updateProgress(100, 'Upload complete!');
                    setTimeout(() => this.showSuccess(), 500);
                    return;
                }
            }
            
        } catch (error) {
            console.error('Chunked upload error:', error);
            alert(`Chunked upload failed: ${error.message}`);
            this.hideProgress();
        }
    }

    async tryMultipartUpload(email, topic) {
        this.updateProgress(60, 'Trying multipart upload...');
        
        // Create FormData
        const formData = new FormData();
        formData.append('video', this.selectedFile);
        formData.append('email', email);
        formData.append('topic', topic);

        const response = await fetch(this.uploadUrl, {
            method: 'POST',
            body: formData,
            mode: 'cors',
            credentials: 'omit'
        });

        this.updateProgress(90, 'Processing...');

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Multipart upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            this.updateProgress(100, 'Upload successful!');
            setTimeout(() => this.showSuccess(), 500);
        } else {
            throw new Error(result.error || 'Multipart upload failed');
        }
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