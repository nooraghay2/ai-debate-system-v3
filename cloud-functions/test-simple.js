exports.testSimple = async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    console.log('=== SIMPLE TEST FUNCTION ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body type:', typeof req.body);
    console.log('Body:', req.body);
    console.log('Raw body length:', req.rawBody ? req.rawBody.length : 'undefined');

    res.status(200).json({
        success: true,
        message: 'Simple test successful',
        method: req.method,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : []
    });
}; 