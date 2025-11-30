// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Company = require('./models/Company');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// DB connect
const MONGO_URI = process.env.MONGO_URL;
mongoose.connect(MONGO_URI, {
  
})
  .then(()=> console.log('Mongo connected'))
  .catch(err => console.error('Mongo connect error:', err));

// Helper: normalize date to start of day (UTC)
function normalizeToDay(date) {
  const d = new Date(date || Date.now());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// POST create/append company entry
// body: { name: string, type: 'increased'|'deceased', percent: number, date?: 'YYYY-MM-DD' }
app.post('/api/company', async (req, res) => {
  try {
    const { name, type, percent, date } = req.body;
    if (!name || !type || percent === undefined) {
      return res.status(400).json({ error: 'name, type and percent are required' });
    }
    const normDate = normalizeToDay(date);
    const entry = {
      date: normDate,
      type: type === 'Decreased' ? 'Decreased' : 'Increased',
      percent: Number(percent),
      createdAt: new Date(),
    };

    // Find by name case-insensitive
    const existing = await Company.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
    if (existing) {
      existing.entries.push(entry);
      await existing.save();
      return res.json({ message: 'Appended to existing company', company: existing });
    } else {
      const company = new Company({
        name,
        entries: [entry],
      });
      await company.save();
      return res.json({ message: 'Created company and added entry', company });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET companies with optional filters
// query parameters:
//  query (company name search substring), day (1-31), month (1-12), year (YYYY), sort (name_asc/name_desc)
app.get('/api/companies', async (req, res) => {
  try {
    const { query = '', day, month, year, sort = 'name_asc' } = req.query;

    // 1. Find all companies that match name search (case-insensitive substring)
    const nameFilter = query ? { name: { $regex: escapeRegex(query), $options: 'i' } } : {};
    let companies = await Company.find(nameFilter).lean();

    // 2. Filter each company's entries by day/month/year if provided
    const hasDay = day !== undefined && day !== '';
    const hasMonth = month !== undefined && month !== '';
    const hasYear = year !== undefined && year !== '';

    function entryMatches(e) {
      const d = new Date(e.date);
      if (hasDay && Number(day) !== d.getUTCDate()) return false;
      if (hasMonth && Number(month) !== (d.getUTCMonth() + 1)) return false;
      if (hasYear && Number(year) !== d.getUTCFullYear()) return false;
      return true;
    }

    // map companies to only include matching entries (if filters present)
    if (hasDay || hasMonth || hasYear) {
      companies = companies
        .map(c => {
          const filteredEntries = (c.entries || []).filter(entryMatches);
          return { ...c, entries: filteredEntries };
        })
        .filter(c => (c.entries || []).length > 0); // only companies that have any matching entries
    }

    // Sort entries within each company by date descending (most recent first)
    companies.forEach(c => {
      c.entries = (c.entries || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    // Sort companies by name
    companies.sort((a, b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      if (an < bn) return sort === 'name_asc' ? -1 : 1;
      if (an > bn) return sort === 'name_asc' ? 1 : -1;
      return 0;
    });

    res.json({ companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// small helper
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// fallback to index.html for SPA style
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname , '/public/index.html'));
});

// /api/company-names?q=abc
// Returns array of matching company names (strings), case-insensitive, limited to 10
/*app.get('/api/company-names', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]); // empty input -> return empty array

    // find up to 10 companies whose name matches the query substring (case-insensitive)
    const docs = await Company.find(
      { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { name: 1, _id: 0 } // select only name
    )
    .limit(10)
    .lean();

    const names = docs.map(d => d.name);
    return res.json(names);
  } catch (err) {
    console.error('company-names error', err);
    return res.status(500).json([]);
  }
});*/

// GET company name suggestions
app.get('/api/company-names', async (req, res) => {
  try {
    const q = req.query.q?.trim() || "";

    if (!q) return res.json([]);

    const companies = await Company.find({
      name: { $regex: `^${q}`, $options: 'i' }
    }).select("name -_id").limit(10);

    res.json(companies.map(c => c.name));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.get('/api/company-history/:name', async (req, res) => {
  try {
    const company = await Company.findOne({ name: req.params.name });
    if (!company) return res.json([]);

    // Sort by date
    const sorted = company.entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(sorted);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching company history");
  }
});


// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
