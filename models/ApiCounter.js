const mongoose = require('mongoose');

const apiCounterSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'geminiSentimentApi'
  },
  count: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('ApiCounter', apiCounterSchema);
