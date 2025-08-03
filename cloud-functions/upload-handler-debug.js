const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = new Storage();
const bucket = storage.bucket(process.env.UPLOAD_BUCKET || 'ai-debate-uploads');

exports.uploadVideoDebug = async (req, res) => {
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

    console.log('=== DEBUG UPLOAD FUNCTION ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body type:', typeof req.body);
    console.log('Body:', req.body);
    console.log('Raw body available:', !!req.rawBody);
    console.log('Raw body type:', typeof req.rawBody);
    console.log('Raw body length:', req.rawBody ? req.rawBody.length : 'undefined');

    // Check if it's multipart/form-data
    if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
        return res.status(400).json({
            success: false,
            error: 'Content-Type must be multipart/form-data',
            debug: {
                contentType: req.headers['content-type'],
                bodyType: typeof req.body,
                rawBodyAvailable: !!req.rawBody
            }
        });
    }

    // If we have a raw body, try to process it
    if (req.rawBody) {
        console.log('Raw body found, attempting to process...');
        // For now, just return success to see if we can access the raw body
        return res.status(200).json({
            success: true,
            message: 'Raw body available',
            debug: {
                rawBodyLength: req.rawBody.length,
                contentType: req.headers['content-type'],
                contentLength: req.headers['content-length']
            }
        });
    } else {
        console.log('No raw body available');
        return res.status(400).json({
            success: false,
            error: 'No raw body available for multipart processing',
            debug: {
                bodyType: typeof req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                contentType: req.headers['content-type']
            }
        });
    }
}; 