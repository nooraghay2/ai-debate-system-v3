const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const port = process.env.PORT || 8080;

// Initialize services
const storage = new Storage();
const bucket = storage.bucket(process.env.UPLOAD_BUCKET || 'ai-debate-uploads');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure CORS
app.use(cors({
    origin: ['https://nooraghay2.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'AI Debate Video Processor is running',
        timestamp: new Date().toISOString()
    });
});

// Main video processing endpoint
app.post('/processDebateVideo', async (req, res) => {
    const startTime = Date.now();
    console.log('Starting video processing...');
    
    try {
        const { videoUrl, fileId, fileName, userEmail, topic } = req.body;
        
        if (!videoUrl || !fileId || !userEmail) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: videoUrl, fileId, userEmail'
            });
        }

        console.log('Processing video:', {
            fileId,
            fileName,
            userEmail,
            topic,
            videoUrl
        });

        // Step 1: Download and transcribe video
        console.log('Step 1: Downloading and transcribing video...');
        const transcription = await downloadAndTranscribe(videoUrl, fileId);
        console.log('Transcription completed:', transcription.substring(0, 100) + '...');

        // Step 2: Generate AI response using Gemini
        console.log('Step 2: Generating AI response...');
        const aiResponse = await generateAIResponse(transcription, topic);
        console.log('AI Response generated:', aiResponse.substring(0, 100) + '...');

        // Step 3: Generate voice-over for the response
        console.log('Step 3: Generating voice-over...');
        const audioFile = await generateVoiceOver(aiResponse, fileId);

        // Step 4: Create animated captions video
        console.log('Step 4: Creating animated captions...');
        const captionsVideo = await createAnimatedCaptions(aiResponse, fileId);

        // Step 5: Combine audio and captions into final video
        console.log('Step 5: Combining into final video...');
        const finalVideo = await combineVideoAndAudio(captionsVideo, audioFile, fileId);

        // Step 6: Upload final video to Cloud Storage
        console.log('Step 6: Uploading final video...');
        const finalVideoUrl = await uploadFinalVideo(finalVideo, fileId, userEmail);

        // Step 7: Send email notification
        console.log('Step 7: Sending email notification...');
        await sendEmailNotification(userEmail, finalVideoUrl, fileName);

        const processingTime = Date.now() - startTime;
        console.log(`Video processing completed in ${processingTime}ms`);

        res.status(200).json({
            success: true,
            message: 'Video processing completed successfully',
            fileId: fileId,
            finalVideoUrl: finalVideoUrl,
            processingTime: processingTime,
            transcription: transcription.substring(0, 200) + '...',
            aiResponse: aiResponse.substring(0, 200) + '...'
        });

    } catch (error) {
        console.error('Video processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Video processing failed',
            details: error.message
        });
    }
});

// Download video and transcribe using FFmpeg and speech recognition
async function downloadAndTranscribe(videoUrl, fileId) {
    const videoPath = `/tmp/${fileId}_input.mp4`;
    const audioPath = `/tmp/${fileId}_audio.wav`;
    
    try {
        // Download video
        console.log('Downloading video from:', videoUrl);
        await execAsync(`curl -L "${videoUrl}" -o "${videoPath}"`);
        
        // Extract audio
        console.log('Extracting audio...');
        await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`);
        
        // Use Google Speech-to-Text (you'll need to set up credentials)
        // For now, we'll use a simple transcription service or mock
        const transcription = await mockTranscription(audioPath);
        
        // Clean up temporary files
        await fs.unlink(videoPath).catch(() => {});
        await fs.unlink(audioPath).catch(() => {});
        
        return transcription;
    } catch (error) {
        console.error('Transcription error:', error);
        throw new Error(`Transcription failed: ${error.message}`);
    }
}

// Mock transcription (replace with actual Google Speech-to-Text)
async function mockTranscription(audioPath) {
    // In production, use Google Speech-to-Text API
    // For now, return a mock transcription
    return "This is a mock transcription of the debate video. The speaker discusses important topics and presents arguments that need to be addressed.";
}

// Generate AI response using Gemini
async function generateAIResponse(transcription, topic) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `You are an expert debate coach and AI assistant. Analyze the following debate video transcription and provide a thoughtful, engaging response.

Transcription: "${transcription}"

Topic: ${topic || 'General debate'}

Please provide:
1. A brief acknowledgment of the speaker's points
2. A thoughtful counter-argument or additional perspective
3. Constructive feedback or suggestions
4. An encouraging conclusion

Make your response engaging, respectful, and educational. Aim for approximately 150-200 words that would take about 60-90 seconds to speak naturally.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error(`AI response generation failed: ${error.message}`);
    }
}

// Generate voice-over using text-to-speech
async function generateVoiceOver(text, fileId) {
    const audioPath = `/tmp/${fileId}_response.wav`;
    
    try {
        // Use Google Text-to-Speech API
        // For now, we'll use a simple TTS service
        await mockTextToSpeech(text, audioPath);
        
        return audioPath;
    } catch (error) {
        console.error('Voice generation error:', error);
        throw new Error(`Voice generation failed: ${error.message}`);
    }
}

// Mock text-to-speech (replace with actual Google TTS)
async function mockTextToSpeech(text, outputPath) {
    // In production, use Google Text-to-Speech API
    // For now, create a silent audio file
    await execAsync(`ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 60 -c:a pcm_s16le "${outputPath}" -y`);
}

// Create animated captions video
async function createAnimatedCaptions(text, fileId) {
    const captionsPath = `/tmp/${fileId}_captions.mp4`;
    
    try {
        // Split text into sentences for captions
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        // Create a video with animated text captions
        await createCaptionsVideo(sentences, captionsPath);
        
        return captionsPath;
    } catch (error) {
        console.error('Captions creation error:', error);
        throw new Error(`Captions creation failed: ${error.message}`);
    }
}

// Create captions video using FFmpeg
async function createCaptionsVideo(sentences, outputPath) {
    try {
        // Create a video with animated text
        const filterComplex = sentences.map((sentence, index) => {
            const startTime = index * 3; // 3 seconds per sentence
            return `drawtext=text='${sentence.replace(/'/g, "\\'")}':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-th-50:enable='between(t,${startTime},${startTime + 2.5})':box=1:boxcolor=black@0.5`;
        }).join(',');

        const duration = sentences.length * 3;
        
        await execAsync(`ffmpeg -f lavfi -i color=size=1280x720:duration=${duration}:rate=30:color=black -vf "${filterComplex}" -c:v libx264 -preset fast -crf 23 "${outputPath}" -y`);
        
    } catch (error) {
        console.error('FFmpeg captions error:', error);
        throw error;
    }
}

// Combine video and audio
async function combineVideoAndAudio(videoPath, audioPath, fileId) {
    const finalPath = `/tmp/${fileId}_final.mp4`;
    
    try {
        await execAsync(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${finalPath}" -y`);
        
        // Clean up intermediate files
        await fs.unlink(videoPath).catch(() => {});
        await fs.unlink(audioPath).catch(() => {});
        
        return finalPath;
    } catch (error) {
        console.error('Video combination error:', error);
        throw new Error(`Video combination failed: ${error.message}`);
    }
}

// Upload final video to Cloud Storage
async function uploadFinalVideo(videoPath, fileId, userEmail) {
    try {
        const fileName = `response_${fileId}.mp4`;
        const filePath = `responses/${fileName}`;
        
        const file = bucket.file(filePath);
        await file.save(await fs.readFile(videoPath), {
            metadata: {
                contentType: 'video/mp4',
                metadata: {
                    originalFileId: fileId,
                    userEmail: userEmail,
                    processedAt: new Date().toISOString(),
                    type: 'ai_response'
                }
            }
        });

        // Make file publicly readable
        await file.makePublic();
        
        // Clean up local file
        await fs.unlink(videoPath).catch(() => {});
        
        return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (error) {
        console.error('Upload error:', error);
        throw new Error(`Final video upload failed: ${error.message}`);
    }
}

// Send email notification
async function sendEmailNotification(userEmail, videoUrl, originalFileName) {
    try {
        // In production, use a proper email service like SendGrid or Gmail API
        console.log(`Email notification would be sent to ${userEmail} with video URL: ${videoUrl}`);
        
        // For now, just log the notification
        const emailContent = `
            Hello!
            
            Your AI debate response video is ready!
            
            Original file: ${originalFileName}
            Response video: ${videoUrl}
            
            Thank you for using our AI Debate Response System!
        `;
        
        console.log('Email content:', emailContent);
        
    } catch (error) {
        console.error('Email notification error:', error);
        // Don't fail the whole process if email fails
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
    });
});

app.listen(port, () => {
    console.log(`AI Debate Video Processor listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Upload bucket: ${process.env.UPLOAD_BUCKET || 'ai-debate-uploads'}`);
}); 