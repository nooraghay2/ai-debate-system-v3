const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Busboy = require('busboy');

const storage = new Storage();
const bucket = storage.bucket(process.env.UPLOAD_BUCKET || 'ai-debate-uploads');

// Handle base64 upload (single file or chunked)
async function handleBase64Upload(req, res) {
    try {
        const { 
            videoData, 
            fileName, 
            fileType, 
            fileSize, 
            email, 
            topic,
            // Chunked upload fields
            uploadId,
            chunkIndex,
            totalChunks,
            chunkData,
            isLastChunk
        } = req.body;

        console.log('Base64 upload data:', {
            fileName,
            fileType,
            fileSize,
            email,
            topic,
            hasVideoData: !!videoData,
            hasChunkData: !!chunkData,
            uploadId,
            chunkIndex,
            totalChunks,
            isLastChunk
        });

        // Check if this is a chunked upload
        if (chunkData && uploadId !== undefined) {
            return await handleChunkedUpload(req, res);
        }

        // Handle single file upload
        if (!videoData) {
            return res.status(400).json({
                success: false,
                error: 'No video data provided'
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Valid email address is required'
            });
        }

        if (!fileType.startsWith('video/')) {
            return res.status(400).json({
                success: false,
                error: 'Only video files are allowed'
            });
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(videoData, 'base64');
        console.log('Converted base64 to buffer, size:', buffer.length);

        // Generate unique filename
        const fileId = uuidv4();
        const fileExtension = path.extname(fileName);
        const newFileName = `upload_${fileId}${fileExtension}`;
        const filePath = `videos/${newFileName}`;

        console.log('Uploading to Cloud Storage:', filePath);

        // Upload to Cloud Storage
        const file = bucket.file(filePath);
        await file.save(buffer, {
            metadata: {
                contentType: fileType,
                metadata: {
                    originalName: fileName,
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
            fileName: fileName,
            userEmail: email,
            topic: topic || '',
            timestamp: new Date().toISOString()
        };

        // Send to Cloud Run for processing
        const cloudRunUrl = process.env.CLOUD_RUN_URL || 'https://processdebatevideo-497659694361.us-central1.run.app/processDebateVideo';
        
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
        } else {
            console.log('Video processing triggered successfully');
        }

        res.status(200).json({
            success: true,
            message: 'Video uploaded successfully and processing started',
            fileId: fileId,
            fileName: fileName,
            fileSize: buffer.length,
            processingTriggered: processingResponse.ok
        });

    } catch (error) {
        console.error('Base64 upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process base64 upload',
            details: error.message
        });
    }
}

// Handle chunked upload
async function handleChunkedUpload(req, res) {
    try {
        const { 
            uploadId,
            chunkIndex,
            totalChunks,
            chunkData,
            fileName,
            fileType,
            fileSize,
            email,
            topic,
            isLastChunk
        } = req.body;

        console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId}`);

        if (!chunkData) {
            return res.status(400).json({
                success: false,
                error: 'No chunk data provided'
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Valid email address is required'
            });
        }

        if (!fileType.startsWith('video/')) {
            return res.status(400).json({
                success: false,
                error: 'Only video files are allowed'
            });
        }

        // Convert chunk to buffer
        const chunkBuffer = Buffer.from(chunkData, 'base64');
        console.log(`Chunk ${chunkIndex + 1} size:`, chunkBuffer.length);

        // Store chunk in temporary location
        const chunkPath = `temp/${uploadId}/chunk_${chunkIndex}`;
        const chunkFile = bucket.file(chunkPath);
        await chunkFile.save(chunkBuffer);

        console.log(`Chunk ${chunkIndex + 1} stored at:`, chunkPath);

        // If this is the last chunk, combine all chunks
        if (isLastChunk) {
            console.log('Combining chunks...');
            
            // Generate unique filename
            const fileId = uuidv4();
            const fileExtension = path.extname(fileName);
            const newFileName = `upload_${fileId}${fileExtension}`;
            const filePath = `videos/${newFileName}`;

            // Combine all chunks
            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const tempChunkPath = `temp/${uploadId}/chunk_${i}`;
                const tempChunkFile = bucket.file(tempChunkPath);
                const [tempChunkBuffer] = await tempChunkFile.download();
                chunks.push(tempChunkBuffer);
            }

            const combinedBuffer = Buffer.concat(chunks);
            console.log('Combined file size:', combinedBuffer.length);

            // Upload combined file
            const file = bucket.file(filePath);
            await file.save(combinedBuffer, {
                metadata: {
                    contentType: fileType,
                    metadata: {
                        originalName: fileName,
                        userEmail: email,
                        topic: topic || '',
                        uploadedAt: new Date().toISOString(),
                        fileId: fileId
                    }
                }
            });

            // Make file publicly readable
            await file.makePublic();

            // Clean up temporary chunks
            for (let i = 0; i < totalChunks; i++) {
                const tempChunkPath = `temp/${uploadId}/chunk_${i}`;
                const tempChunkFile = bucket.file(tempChunkPath);
                await tempChunkFile.delete().catch(err => console.log('Error deleting temp chunk:', err));
            }

            console.log('File uploaded successfully to Cloud Storage');

            // Trigger video processing
            const processingPayload = {
                videoUrl: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
                fileId: fileId,
                fileName: fileName,
                userEmail: email,
                topic: topic || '',
                timestamp: new Date().toISOString()
            };

            const cloudRunUrl = process.env.CLOUD_RUN_URL || 'https://processdebatevideo-497659694361.us-central1.run.app/processDebateVideo';
            
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
            } else {
                console.log('Video processing triggered successfully');
            }

            res.status(200).json({
                success: true,
                message: 'Video uploaded successfully and processing started',
                fileId: fileId,
                fileName: fileName,
                fileSize: combinedBuffer.length,
                processingTriggered: processingResponse.ok,
                isLastChunk: true
            });
        } else {
            // Not the last chunk, just acknowledge receipt
            res.status(200).json({
                success: true,
                message: `Chunk ${chunkIndex + 1} uploaded successfully`,
                isLastChunk: false
            });
        }

    } catch (error) {
        console.error('Chunked upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chunked upload',
            details: error.message
        });
    }
}

exports.uploadVideo = async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Content-Length');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log('Processing upload request...');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Content-Length:', req.headers['content-length']);

        // Check if it's JSON (for base64 upload) or multipart/form-data
        const isJson = req.headers['content-type'] && req.headers['content-type'].includes('application/json');
        const isMultipart = req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data');

        if (!isJson && !isMultipart) {
            return res.status(400).json({
                success: false,
                error: 'Content-Type must be application/json or multipart/form-data'
            });
        }

        // Handle JSON base64 upload
        if (isJson) {
            console.log('Processing JSON base64 upload...');
            return await handleBase64Upload(req, res);
        }

        // Handle multipart upload (existing code)
        console.log('Processing multipart upload...');

        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: 100 * 1024 * 1024, // 100MB limit
                files: 1
            }
        });

        let fileData = null;
        let email = null;
        let topic = null;
        let hasError = false;

        busboy.on('file', (fieldname, file, info) => {
            console.log('Processing file:', fieldname, info);
            
            if (fieldname !== 'video') {
                hasError = true;
                return res.status(400).json({
                    success: false,
                    error: 'Only "video" field is allowed for file upload'
                });
            }

            if (!info.mimeType.startsWith('video/')) {
                hasError = true;
                return res.status(400).json({
                    success: false,
                    error: 'Only video files are allowed'
                });
            }

            const chunks = [];
            file.on('data', (chunk) => {
                chunks.push(chunk);
            });

            file.on('end', () => {
                fileData = {
                    buffer: Buffer.concat(chunks),
                    originalname: info.filename,
                    mimetype: info.mimeType,
                    size: Buffer.concat(chunks).length
                };
                console.log('File received:', fileData.originalname, 'Size:', fileData.size);
            });

            file.on('error', (err) => {
                console.error('File processing error:', err);
                hasError = true;
                return res.status(400).json({
                    success: false,
                    error: 'File processing error: ' + err.message
                });
            });
        });

        busboy.on('field', (fieldname, value) => {
            console.log('Field received:', fieldname, value);
            if (fieldname === 'email') {
                email = value;
            } else if (fieldname === 'topic') {
                topic = value;
            }
        });

        busboy.on('finish', async () => {
            if (hasError) return;

            console.log('Busboy finished processing');
            console.log('File data:', fileData ? 'Present' : 'Missing');
            console.log('Email:', email);
            console.log('Topic:', topic);

            if (!fileData) {
                return res.status(400).json({
                    success: false,
                    error: 'No video file provided'
                });
            }

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid email address is required'
                });
            }

            try {
                // Generate unique filename
                const fileId = uuidv4();
                const fileExtension = path.extname(fileData.originalname);
                const fileName = `upload_${fileId}${fileExtension}`;
                const filePath = `videos/${fileName}`;

                console.log('Uploading to Cloud Storage:', filePath);

                // Upload to Cloud Storage
                const file = bucket.file(filePath);
                await file.save(fileData.buffer, {
                    metadata: {
                        contentType: fileData.mimetype,
                        metadata: {
                            originalName: fileData.originalname,
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
                    fileName: fileData.originalname,
                    userEmail: email,
                    topic: topic || '',
                    timestamp: new Date().toISOString()
                };

                // Send to Cloud Run for processing
                const cloudRunUrl = process.env.CLOUD_RUN_URL || 'https://processdebatevideo-497659694361.us-central1.run.app/processDebateVideo';
                
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
                } else {
                    console.log('Video processing triggered successfully');
                }

                res.status(200).json({
                    success: true,
                    message: 'Video uploaded successfully and processing started',
                    fileId: fileId,
                    fileName: fileData.originalname,
                    fileSize: fileData.size,
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

        busboy.on('error', (err) => {
            console.error('Busboy error:', err);
            res.status(400).json({
                success: false,
                error: 'Upload processing error: ' + err.message
            });
        });

        // Pipe the request to busboy
        req.pipe(busboy);

    } catch (error) {
        console.error('General error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}; 