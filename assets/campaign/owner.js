const notice = document.querySelector('#notice');
const results = document.querySelector('#results-status');
const dashboard = document.querySelector('#dashboard');
const login = document.querySelector('#login');
const logout = document.querySelector('#logout');
const records = document.querySelector('#records');
const search = document.querySelector('#search');
const filter = document.querySelector('#filter');
const exportButton = document.querySelector('#export');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const tabs = [...document.querySelectorAll('[data-view]')];
const statuses = { received: 'Received', reviewing: 'Under review', closed: 'Closed' };
const products = { uae: 'Falcon Hoodie', saudi: 'Riyadh Airspace Hoodie', bahrain: 'Bahrain Sail Towers Hoodie', qatar: 'Doha Museum Hoodie', kuwait: 'Kuwait Towers Hoodie', oman: 'Oman Dhow Hoodie' };
let selection = { view: 'preorders', q: '', status: '' };
let page = 0;
let revision = 0;

async function fetchRows(filters, pageNumber) {
  const params = new URLSearchParams({ ...filters, page: pageNumber });
  const response = await fetch('/api/owner?' + params, { cache: 'no-store' });
  if (!response.ok) throw new Error(await response.json().then(data => data.error).catch(() => 'unknown'));
  return response.json();
}

function date(value) {
  if (!value) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value.replace(' ', 'T') + 'Z'));
}

function items(row) {
  return row.items.map(item => `${products[item.id] || item.id} × ${item.quantity}`).join(', ');
}

function paragraph(text) {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

function showRecord(row) {
  const record = document.createElement('article');
  record.className = 'record';
  const heading = document.createElement('h2');
  heading.textContent = row.email;
  record.append(heading);
  if (selection.view === 'people') {
    record.append(paragraph(`Last sign-in: ${date(row.last_seen)} · ${row.preorder_count} preorder(s)`));
    return record;
  }
  record.append(
    paragraph(`${date(row.created_at)} · BHD ${row.total_bhd} · ${items(row)}`),
    paragraph(`Reference: ${row.reference}`),
  );
  const controls = document.createElement('div');
  controls.className = 'record-actions';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Status for ' + row.reference);
  for (const [value, label] of Object.entries(statuses)) select.add(new Option(label, value));
  select.value = row.status;
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Save status';
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const response = await fetch('/api/owner-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: row.reference, status: select.value }),
      });
      if (!response.ok) throw new Error('save');
      if (selection.status && selection.status !== select.value) await load();
      results.textContent = 'Status saved for ' + row.email + '.';
    } catch {
      results.textContent = 'Status could not be saved. Try again.';
    } finally {
      save.disabled = false;
    }
  });
  controls.append(select, save);
  record.append(controls);
  return record;
}

async function load() {
  const current = ++revision;
  records.replaceChildren();
  results.textContent = 'Loading…';
  previous.disabled = true;
  next.disabled = true;
  try {
    const data = await fetchRows(selection, page);
    if (current !== revision) return;
    dashboard.hidden = false;
    login.hidden = true;
    logout.hidden = false;
    notice.textContent = '';
    records.replaceChildren(...data.rows.map(showRecord));
    results.textContent = data.rows.length ? '' : 'No matching records.';
    previous.disabled = page === 0;
    next.disabled = !data.hasNext;
    document.querySelector('#page-number').textContent = 'Page ' + (page + 1);
  } catch (error) {
    if (current !== revision) return;
    dashboard.hidden = true;
    login.hidden = !['sign_in', 'forbidden'].includes(error.message);
    logout.hidden = error.message !== 'forbidden';
    notice.textContent = {
      sign_in: new URL(location.href).searchParams.has('account') ? 'Sign-in failed. Please try again.' : 'Sign in with your business owner Google account.',
      forbidden: 'This Google account does not have owner access. Sign in with the email configured for JetMajlis.',
      owner_not_configured: 'Owner access is not configured yet.',
    }[error.message] || 'The dashboard is temporarily unavailable.';
  }
}

document.querySelector('#filters').addEventListener('submit', (event) => {
  event.preventDefault();
  selection = { ...selection, q: search.value, status: filter.value };
  page = 0;
  void load();
});
for (const button of tabs) {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    selection = { view, q: '', status: '' };
    search.value = '';
    search.placeholder = view === 'people' ? 'Email' : 'Email or reference';
    filter.value = '';
    document.querySelector('#filter-label').hidden = view === 'people';
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab === button));
    page = 0;
    void load();
  });
}
previous.addEventListener('click', () => { page--; void load(); });
next.addEventListener('click', () => { page++; void load(); });
logout.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (!response.ok) throw new Error('logout');
    await load();
  } catch {
    notice.textContent = 'Sign-out failed. Please try again.';
  }
});

function cell(value) {
  const text = String(value ?? '');
  const safe = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  const filters = { ...selection };
  const people = filters.view === 'people';
  const lines = [people ? ['Email', 'Last sign-in (UTC)', 'Preorders'] : ['Email', 'Reference', 'Items', 'Total BHD', 'Status', 'Created (UTC)']];
  try {
    for (let cursor = 0; ; cursor++) {
      const data = await fetchRows(filters, cursor);
      for (const row of data.rows) {
        lines.push(people ? [row.email, row.last_seen, row.preorder_count]
          : [row.email, row.reference, items(row), row.total_bhd, statuses[row.status], row.created_at]);
      }
      if (!data.hasNext) break;
    }
    const csv = lines.map(line => line.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `jetmajlis-${filters.view}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    results.textContent = 'Export failed. Please try again.';
  } finally {
    exportButton.disabled = false;
  }
});

void load();
