// models/Company.js
const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema({
  date: { type: Date, required: true }, // normalized to day (UTC midnight)
  type: { type: String, enum: ['Increased', 'Decreased'], required: true },
  percent: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  entries: { type: [EntrySchema], default: [] },
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', CompanySchema);
