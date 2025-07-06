const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  commentId: { type: String, required: true, unique: true },
  sentiment: {
    sentiment: String,
    confidence: Number,
    emotions: [String],
    toxicity: Number,
    summary: String
  },
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommentRecord', commentSchema);
