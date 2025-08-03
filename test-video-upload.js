const fs = require('fs');
const path = require('path');

async function testVideoUpload() {
    const videoPath = path.join(__dirname, 'jacqueline_brattan_debate.mp4');
    const functionUrl = 'https://us-central1-ai-human-api-system.cloudfunctions.net/upload-video';
    
    console.log('Testing video upload...');
    console.log('Video file:', videoPath);
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
        console.error('Video file not found!');
        return;
    }
    
    const stats = fs.statSync(videoPath);
    console.log('File size:', stats.size, 'bytes');
    
    // Read file and convert to base64
    console.log('Converting to base64...');
    const videoBuffer = fs.readFileSync(videoPath);
    const base64 = videoBuffer.toString('base64');
    
    console.log('Base64 length:', base64.length);
    
    // Create payload
    const payload = {
        videoData: base64,
        fileName: 'jacqueline_brattan_debate.mp4',
        fileType: 'video/mp4',
        fileSize: stats.size,
        email: 'test@example.com',
        topic: 'test upload'
    };
    
    console.log('Payload size:', JSON.stringify(payload).length, 'characters');
    
    try {
        console.log('Sending request...');
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response:', responseText);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testVideoUpload(); 