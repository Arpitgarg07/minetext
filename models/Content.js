const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  spaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    required: true
  },
  text: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  images: [{
    filename: String,
    originalName: String,
    storedName: String,
    mimeType: String,
    size: Number
  }]
}, {
  timestamps: true
});

// Index for efficient space content queries
contentSchema.index({ spaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Content', contentSchema);