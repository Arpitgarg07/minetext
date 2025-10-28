require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Models
const Space = require('./models/Space');
const Content = require('./models/Content');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['your-domain.com'] : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 6 // max 6 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Utility functions
function createToken(spaceName, role = 'admin') {
  return jwt.sign(
    { spaceName, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.tokenPayload = payload;
    next();
  });
}

function authorizeSpace(req, res, next) {
  const { spaceName } = req.params;
  if (req.tokenPayload.spaceName !== spaceName) {
    return res.status(403).json({ error: 'Unauthorized for this space' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.tokenPayload.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// API Routes

// Create a new Space
app.post('/api/spaces', async (req, res) => {
  try {
    const { name, viewPassword, adminPassword } = req.body;

    // Validation
    if (!name || !viewPassword || !adminPassword) {
      return res.status(400).json({ error: 'Space name, view password, and admin password are required' });
    }

    if (!/^[a-zA-Z0-9-_]{3,40}$/.test(name)) {
      return res.status(400).json({ error: 'Space name must be 3-40 characters, letters/numbers/-/_ only' });
    }

    if (viewPassword.length < 6) {
      return res.status(400).json({ error: 'View password must be at least 6 characters' });
    }

    if (adminPassword.length < 6) {
      return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
    }

    // Check if space already exists
    const existingSpace = await Space.findOne({ name });
    if (existingSpace) {
      return res.status(409).json({ error: 'Space name already taken' });
    }

    // Hash both passwords and create space
    const viewPasswordHash = await bcrypt.hash(viewPassword, 12);
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const space = new Space({ name, viewPasswordHash, adminPasswordHash });
    await space.save();

    // Create admin token for immediate access
    const token = createToken(name, 'admin');

    res.status(201).json({
      ok: true,
      token,
      space: {
        name: space.name,
        id: space._id,
        createdAt: space.createdAt
      }
    });
  } catch (error) {
    console.error('Create space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if space exists
app.get('/api/spaces/:spaceName/exists', async (req, res) => {
  try {
    const { spaceName } = req.params;
    const space = await Space.findOne({ name: spaceName });
    res.json({ exists: !!space });
  } catch (error) {
    console.error('Check space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login to get JWT token (checks both view and admin passwords)
app.post('/api/spaces/:spaceName/login', async (req, res) => {
  try {
    const { spaceName } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Find space
    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    // Check if it's admin password first
    const isAdmin = await bcrypt.compare(password, space.adminPasswordHash);
    if (isAdmin) {
      const token = createToken(spaceName, 'admin');
      return res.json({ ok: true, token, role: 'admin' });
    }

    // Check if it's view password
    const isViewer = await bcrypt.compare(password, space.viewPasswordHash);
    if (isViewer) {
      const token = createToken(spaceName, 'viewer');
      return res.json({ ok: true, token, role: 'viewer' });
    }

    // Neither password matched
    return res.status(401).json({ error: 'Invalid password' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View space content (requires authentication with either view or admin password)
app.get('/api/spaces/:spaceName', authenticateToken, authorizeSpace, async (req, res) => {
  try {
    const { spaceName } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Find space
    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    // Get content with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const contents = await Content.find({ spaceId: space._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      ok: true,
      space: {
        name: space.name,
        createdAt: space.createdAt,
        contents: contents
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: contents.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add content to space (admin only)
app.post('/api/spaces/:spaceName/content', authenticateToken, authorizeSpace, requireAdmin, upload.array('images', 6), async (req, res) => {
  try {
    const { spaceName } = req.params;
    const { text } = req.body;

    // Find space
    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    // Prepare content data
    const contentData = {
      spaceId: space._id,
      text: text?.trim() || '',
      images: []
    };

    // Process uploaded images
    if (req.files && req.files.length > 0) {
      contentData.images = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size
      }));
    }

    // Create content
    const content = new Content(contentData);
    await content.save();

    res.status(201).json({
      ok: true,
      content: {
        id: content._id,
        text: content.text,
        images: content.images,
        createdAt: content.createdAt
      }
    });
  } catch (error) {
    console.error('Add content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update content (admin only)
app.put('/api/spaces/:spaceName/content/:contentId', authenticateToken, authorizeSpace, requireAdmin, async (req, res) => {
  try {
    const { spaceName, contentId } = req.params;
    const { text } = req.body;

    console.log('Update content request:', { spaceName, contentId, text: text?.substring(0, 50) });

    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      console.log('Space not found:', spaceName);
      return res.status(404).json({ error: 'Space not found' });
    }

    const content = await Content.findOneAndUpdate(
      { _id: contentId, spaceId: space._id },
      { text: text?.trim() || '' },
      { new: true }
    );

    if (!content) {
      console.log('Content not found:', contentId);
      return res.status(404).json({ error: 'Content not found' });
    }

    console.log('Content updated successfully');
    res.json({ ok: true, content });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete content (admin only)
app.delete('/api/spaces/:spaceName/content/:contentId', authenticateToken, authorizeSpace, requireAdmin, async (req, res) => {
  try {
    const { spaceName, contentId } = req.params;

    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const content = await Content.findOneAndDelete({ _id: contentId, spaceId: space._id });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Delete associated image files
    if (content.images && content.images.length > 0) {
      content.images.forEach(image => {
        const filepath = path.join(__dirname, 'uploads', image.storedName);
        fs.unlink(filepath, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    res.json({ ok: true, message: 'Content deleted' });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add images to existing content (admin only)
app.post('/api/spaces/:spaceName/content/:contentId/images', authenticateToken, authorizeSpace, requireAdmin, upload.array('images', 6), async (req, res) => {
  try {
    const { spaceName, contentId } = req.params;

    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const content = await Content.findOne({ _id: contentId, spaceId: space._id });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const newImages = req.files.map(file => ({
      originalName: file.originalname,
      storedName: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    content.images = [...(content.images || []), ...newImages];
    await content.save();

    res.json({ ok: true, content });
  } catch (error) {
    console.error('Add images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete image from content (admin only)
app.delete('/api/spaces/:spaceName/content/:contentId/images/:imageName', authenticateToken, authorizeSpace, requireAdmin, async (req, res) => {
  try {
    const { spaceName, contentId, imageName } = req.params;

    const space = await Space.findOne({ name: spaceName });
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const content = await Content.findOne({ _id: contentId, spaceId: space._id });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Remove image from array
    content.images = content.images.filter(img => img.storedName !== imageName);
    await content.save();

    // Delete file
    const filepath = path.join(__dirname, 'uploads', imageName);
    fs.unlink(filepath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });

    res.json({ ok: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve static frontend files
app.use(express.static('.'));

// Handle SPA routing - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 6 files.' });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});