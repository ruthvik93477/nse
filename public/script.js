// public/script.js
document.addEventListener('DOMContentLoaded', () => {
  const addForm = document.getElementById('addForm');
  const results = document.getElementById('results');
  const searchQuery = document.getElementById('searchQuery');
  const filterDay = document.getElementById('filterDay');
  const filterMonth = document.getElementById('filterMonth');
  const filterYear = document.getElementById('filterYear');
  const sortSelect = document.getElementById('sort');
  const applyFiltersBtn = document.getElementById('applyFilters');

  // Load initial list
  fetchAndRender();

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const type = document.getElementById('type').value;
    const percent = document.getElementById('percent').value;
    const date = document.getElementById('date').value || undefined;

    if (!name || !percent) return alert('Provide name and percent');

    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, percent, date })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error adding');
      // clear small fields
      document.getElementById('name').value = '';
      document.getElementById('percent').value = '';
      document.getElementById('date').value = '';
      // refresh list
      fetchAndRender();
    } catch (err) {
      console.error(err);
      alert('Failed to add entry');
    }
  });

  applyFiltersBtn.addEventListener('click', fetchAndRender);
  searchQuery.addEventListener('keyup', debounce(fetchAndRender, 350));
  sortSelect.addEventListener('change', fetchAndRender);

  async function fetchAndRender() {
    const params = new URLSearchParams();
    if (searchQuery.value.trim()) params.set('query', searchQuery.value.trim());
    if (filterDay.value) params.set('day', filterDay.value);
    if (filterMonth.value) params.set('month', filterMonth.value);
    if (filterYear.value) params.set('year', filterYear.value);
    if (sortSelect.value) params.set('sort', sortSelect.value);

    try {
      const r = await fetch('/api/companies?' + params.toString());
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Fetch error');
      renderCompanies(json.companies || []);
    } catch (err) {
      console.error(err);
      results.innerHTML = `<div class="alert alert-danger small">Error loading data</div>`;
    }
  }

  function renderCompanies(companies) {
    if (!companies.length) {
      results.innerHTML = `<div class="card"><div class="card-body small text-muted">No records found.</div></div>`;
      return;
    }

    const html = companies.map(c => {
      const entriesHtml = (c.entries || []).map(e => {
        const date = new Date(e.date);
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = (date.getUTCMonth()+1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        return `<li class="list-group-item d-flex justify-content-between align-items-center small">
                  <div>
                    <span class="fw-bold ${e.type === 'Increased' ? 'text-success' : 'text-danger'}">
                    ${e.type === 'Increased' ? '▲' : '▼'} ${e.percent}%
                    </span>
                    &nbsp;
                    <span class="text-muted">(${day}-${month}-${year})</span>
                  </div>
                  <div class="text-end"><small class="text-muted">${new Date(e.createdAt).toLocaleString()}</small></div>
                </li>`;
      }).join('');

      return `<div class="card mb-2">
                <div class="card-body p-2">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 class="mb-0">${escapeHtml(c.name)}</h6>
                      <small class="text-muted">${(c.entries || []).length} entry(ies)</small>
                    </div>
                    <div>
                    <button class="btn btn-sm btn-primary" onclick="showChart('${c.name}')">
                        View
                        </button>
                    </div>
                    <div class="text-end">
                      <small class="text-muted">Latest: ${formatLatest(c.entries && c.entries[0])}</small>
                    </div>
                  </div>
                </div>
                <ul class="list-group list-group-flush small">
                  ${entriesHtml || '<li class="list-group-item small text-muted">No entries for selected filter</li>'}
                </ul>
              </div>`;
    }).join('');

    results.innerHTML = html;
  }

  function formatLatest(e) {
  if (!e) return '—';
  const d = new Date(e.date);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth()+1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  return `<span class="${e.type === 'Increased' ? 'text-success' : 'text-danger'}">
            ${e.type === 'Increased' ? '+' : '-'}${e.percent}% (${day}-${month}-${year})
          </span>`;
}


  function debounce(fn, ms=300){
    let t;
    return function(...a){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(this, a), ms);
    };
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function(m){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
    });
  }
});

// Autocomplete for #name input (debounced)
(() => {
  const API = '/api/company-names';
  const nameInput = document.getElementById('name');
  if (!nameInput) return;

  // create suggestions container if not present
  let suggestions = document.getElementById('suggestions');
  if (!suggestions) {
    suggestions = document.createElement('ul');
    suggestions.id = 'suggestions';
    suggestions.className = 'list-group position-absolute w-100';
    // try to insert right after input
    nameInput.parentNode.style.position = 'relative'; // ensure positioned parent
    nameInput.parentNode.appendChild(suggestions);
  }

  let activeIndex = -1;
  let items = [];

  // debounce helper
  function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  async function fetchNames(q) {
    try {
      const resp = await fetch(`${API}?q=${encodeURIComponent(q)}`);
      if (!resp.ok) return [];
      const arr = await resp.json();
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.error('autocomplete fetch error', e);
      return [];
    }
  }

  function render(list) {
    items = list;
    activeIndex = -1;
    if (!list.length) {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      return;
    }
    suggestions.style.display = 'block';
    suggestions.innerHTML = list.map((name, i) => `
      <li class="list-group-item list-group-item-action p-2 suggestion-item" data-i="${i}" style="font-size:.95rem">
        ${escapeHtml(name)}
      </li>
    `).join('');
  }

  // simple escape
  function escapeHtml(s) {
    return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // click selection (event delegation)
  suggestions.addEventListener('click', (e) => {
    const li = e.target.closest('.suggestion-item');
    if (!li) return;
    const i = Number(li.dataset.i);
    selectItem(i);
  });

  // keyboard support: ArrowUp/ArrowDown/Enter/Escape
  nameInput.addEventListener('keydown', (e) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      highlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlight();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        selectItem(activeIndex);
      }
    } else if (e.key === 'Escape') {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      items = [];
      activeIndex = -1;
    }
  });

  function highlight() {
    const lis = suggestions.querySelectorAll('.suggestion-item');
    lis.forEach((li, idx) => {
      if (idx === activeIndex) {
        li.classList.add('active');
        // ensure visible
        li.scrollIntoView({ block: 'nearest' });
      } else {
        li.classList.remove('active');
      }
    });
  }

  function selectItem(i) {
    const val = items[i];
    if (!val) return;
    nameInput.value = val;
    // hide suggestions
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    items = [];
    activeIndex = -1;
    // optionally, move focus to percent field:
    const percent = document.getElementById('percent') || document.getElementById('value');
    if (percent) percent.focus();
  }

  // When user types, debounce requests
  const onType = debounce(async () => {
    const q = nameInput.value.trim();
    if (!q) {
      render([]);
      return;
    }
    const names = await fetchNames(q);
    render(names);
  }, 250);

  nameInput.addEventListener('input', onType);

  // close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!nameInput.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      items = [];
      activeIndex = -1;
    }
  });

})();

    const today = new Date();

    // Format the date as YYYY-MM-DD
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed, add 1
    const day = String(today.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;

    // Set the value of the date input field
    document.getElementById("date").value = formattedDate;

    let chartInstance = null;

async function showChart(name) {
  document.getElementById("chartTitle").innerText = `${name} Growth Trend`;

  const res = await fetch(`/api/company-history/${name}`);
  const history = await res.json();

  const labels = history.map(e => {
    const d = new Date(e.date);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  });

  const values = history.map(e => {
    const percent = Number(e.percent);

    return e.type === "Decreased" 
      ? -Math.abs(percent) 
      : Math.abs(percent);
  });

  const ctx = document.getElementById("growthChart").getContext("2d");

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${name} % Change`,
        data: values,
        borderWidth: 3,
        tension: 0.3,
        borderColor: values.some(v => v < 0) ? 'red' : 'green',
        pointBackgroundColor: values.map(v => v < 0 ? 'red' : 'green')
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  new bootstrap.Modal(document.getElementById("chartModal")).show();
}
