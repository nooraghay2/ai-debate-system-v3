const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = new Storage();
const bucket = storage.bucket(process.env.UPLOAD_BUCKET || 'ai-debate-uploads');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

exports.uploadVideo = async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        // Handle file upload
        upload.single('video')(req, res, async (err) => {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No video file provided'
                });
            }

            const { email, topic } = req.body;

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid email address is required'
                });
            }

            try {
                // Generate unique filename
                const fileId = uuidv4();
                const fileExtension = path.extname(req.file.originalname);
                const fileName = `upload_${fileId}${fileExtension}`;
                const filePath = `videos/${fileName}`;

                console.log('Uploading file:', {
                    originalName: req.file.originalname,
                    fileId: fileId,
                    filePath: filePath,
                    size: req.file.size,
                    email: email,
                    topic: topic
                });

                // Upload to Cloud Storage
                const file = bucket.file(filePath);
                await file.save(req.file.buffer, {
                    metadata: {
                        contentType: req.file.mimetype,
                        metadata: {
                            originalName: req.file.originalname,
                            userEmail: email,
                            topic: topic || '',
                            uploadedAt: new Date().toISOString(),
                            fileId: fileId
                        }
                    }
                });

                // Make file publicly readable (for processing)
                await file.makePublic();

                console.log('File uploaded successfully to Cloud Storage');

                // Trigger video processing
                const processingPayload = {
                    videoUrl: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
                    fileId: fileId,
                    fileName: req.file.originalname,
                    userEmail: email,
                    topic: topic || '',
                    timestamp: new Date().toISOString()
                };

                // Send to Cloud Run for processing
                const cloudRunUrl = process.env.CLOUD_RUN_URL || 'https://processdebatevideo-ai-human-api-system.us-central1.run.app/processDebateVideo';
                
                console.log('Triggering video processing at:', cloudRunUrl);
                
                const processingResponse = await fetch(cloudRunUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(processingPayload)
                });

                if (!processingResponse.ok) {
                    console.error('Processing trigger failed:', await processingResponse.text());
                    // Don't fail the upload, just log the error
                    // The processing can be retried later
                } else {
                    console.log('Video processing triggered successfully');
                }

                res.status(200).json({
                    success: true,
                    message: 'Video uploaded successfully and processing started',
                    fileId: fileId,
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    processingTriggered: processingResponse.ok
                });

            } catch (uploadError) {
                console.error('Storage upload error:', uploadError);
                res.status(500).json({
                    success: false,
                    error: 'Failed to upload video to storage',
                    details: uploadError.message
                });
            }
        });

    } catch (error) {
        console.error('General error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}; 