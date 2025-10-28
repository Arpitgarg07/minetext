const mongoose = require('mongoose');

const spaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 40,
    match: /^[a-zA-Z0-9-_]+$/
  },
  viewPasswordHash: {
    type: String,
    required: true
  },
  adminPasswordHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Space', spaceSchema);