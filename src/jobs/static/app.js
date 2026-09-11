const $ = selector => document.querySelector(selector);
const states = ['review', 'reject', 'accept', 'applied', 'interviewing'];
let jobs = [], selectedId = null, busy = false, noticeTimer;
const dateLabel = value => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}) : 'Date unknown';
function node(tag, cls, text) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
}
function notice(text) {
  $('#message').textContent = text; $('#message').hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('#message').hidden = true, 6000);
}
async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Unable to save. Please try again.');
  }
  return response.json();
}
function visibleJobs() {
  const term = $('#search').value.toLowerCase();
  return jobs.filter(job => ($('#filter').value === 'all' || job.status === $('#filter').value) && `${job.title} ${job.company} ${job.platform}`.toLowerCase().includes(term))
    .sort((a,b) => $('#sort').value === 'score' ? b.ai_match_score - a.ai_match_score || b.id-a.id : (b.posted_at || '').localeCompare(a.posted_at || '') || b.id-a.id);
}
function badge(status) { return node('span', `badge ${status}`, status); }
function render() {
  const visible = visibleJobs();
  if (!visible.some(job => job.id === selectedId)) selectedId = visible[0]?.id ?? null;
  $('#count').textContent = visible.length;
  const list = $('#job-list'); list.replaceChildren();
  for (const job of visible) {
    const card = node('button', `job-card${job.id === selectedId ? ' selected' : ''}${job.favourite ? ' favourite' : ''}`);
    card.setAttribute('aria-pressed', String(job.id === selectedId));
    const top = node('div', 'card-top'); top.append(node('span', 'company', job.company), node('span', 'mini-score', `${job.ai_match_score} match`));
    if (job.favourite) {
      const heart = node('span', 'card-heart', '♥'); heart.setAttribute('aria-label', 'Favourite'); top.prepend(heart);
    }
    const bottom = node('div', 'card-bottom'); bottom.append(node('span', '', dateLabel(job.posted_at)), badge(job.status));
    card.append(top, node('h2', '', job.title), node('p', 'summary', job.ai_match_summary), bottom);
    card.onclick = () => { if (!busy) { selectedId = job.id; render(); } };
    list.append(card);
  }
  if (!visible.length) list.append(node('p', 'list-empty', jobs.length ? 'No jobs match your filters.' : 'New finds will appear here.'));
  renderDetail(jobs.find(job => job.id === selectedId));
}
function renderDetail(job) {
  const detail = $('#detail'); detail.replaceChildren();
  if (!job) {
    const empty = node('div', 'empty');
    empty.append(node('span', 'empty-symbol', '↗'), node('h2', '', jobs.length ? 'Room for a different search.' : 'Your next chapter starts here.'), node('p', '', jobs.length ? 'Try another filter or search term.' : 'Add your CV and goals to user/cv.MD and user/goals.MD, then ask your agent to find jobs. Refresh to see your results.'));
    detail.append(empty); return;
  }
  const article = node('article', 'job-detail');
  const heading = node('div', 'detail-heading');
  const identity = node('div'); identity.append(node('div', 'eyebrow', `${job.platform} / ${job.company}`), node('h2', 'job-title', job.title));
  const score = node('div', 'score'); score.append(node('strong', '', job.ai_match_score), node('span', '', 'MATCH / 100'));
  const corner = node('div', 'detail-corner');
  const heart = node('button', `favourite-button${job.favourite ? ' active' : ''}`, job.favourite ? '♥' : '♡');
  heart.setAttribute('aria-label', job.favourite ? 'Remove from favourites' : 'Add to favourites');
  heart.title = heart.getAttribute('aria-label');
  heart.setAttribute('aria-pressed', String(job.favourite)); heart.disabled = busy;
  heart.onclick = () => updateFavourite(job);
  corner.append(heart, score); heading.append(identity, corner);
  const metadata = node('div', 'metadata');
  for (const text of [job.location || 'Location not listed', job.salary || 'Salary not listed', job.contract_type, job.experience_level, `Posted ${dateLabel(job.posted_at)}`].filter(Boolean)) metadata.append(node('span', '', text));
  const assessment = node('section', 'assessment'); assessment.append(node('div', 'eyebrow', 'THE FIT'), node('p', '', job.ai_match_summary));
  const skills = node('div', 'skills-grid');
  for (const [key, title, cls] of [['matching_skills', 'What you bring', 'matching'], ['missing_skills', 'Gaps to consider', 'missing']]) {
    const section = node('section'); section.append(node('h3', '', title)); const tags = node('div', 'tags');
    job[key].forEach(skill => tags.append(node('span', `tag ${cls}`, skill)));
    if (!job[key].length) tags.append(node('p', 'muted', key === 'matching_skills' ? 'No matching skills documented.' : 'No specific gaps identified.'));
    section.append(tags); skills.append(section);
  }
  const description = node('section', 'description'); description.append(node('h3', '', 'About the role'), node('div', 'description-text', job.description));
  const footnote = node('p', 'footnote', `Found ${dateLabel(job.discovered_at)} · Status updated ${dateLabel(job.status_changed_at)}${job.applied_at ? ' · Applied ' + dateLabel(job.applied_at) : ''}`);
  article.append(heading, metadata, assessment, skills, description, footnote);
  const actions = node('footer', 'actions'); const stateGroup = node('div', 'state-group');
  stateGroup.append(node('div', 'eyebrow', 'KEEP TRACK'));
  const buttons = node('div', 'state-buttons'); buttons.setAttribute('role', 'group'); buttons.setAttribute('aria-label', 'Job state');
  states.forEach(state => { const button = node('button', `state-button${job.status === state ? ' active' : ''}`, state); button.setAttribute('aria-pressed', String(job.status === state)); button.disabled = busy; button.onclick = () => updateStatus(job, state); buttons.append(button); });
  stateGroup.append(buttons);
  const apply = node('button', 'apply', 'Apply ↗'); apply.disabled = busy;
  apply.onclick = async () => {
    // Open synchronously so browser popup protection doesn't block the new tab.
    const tab = window.open('about:blank', '_blank');
    if (!tab) { notice('Allow pop-ups for this app, then click Apply again.'); return; }
    tab.opener = null;
    if (await updateStatus(job, 'applied')) tab.location.replace(job.url);
    else tab.close();
  };
  actions.append(stateGroup, apply); detail.append(article, actions);
}
async function updateStatus(job, status) {
  if (busy) return false;
  busy = true; renderDetail(job);
  try {
    const updated = await request(`/api/jobs/${job.id}/status`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status})});
    jobs = jobs.map(item => item.id === updated.id ? updated : item);
    notice(`Marked as ${status}.`); return true;
  } catch (error) { notice(error.message); return false; }
  finally { busy = false; render(); }
}
async function updateFavourite(job) {
  if (busy) return;
  busy = true; renderDetail(job);
  try {
    const updated = await request(`/api/jobs/${job.id}/favourite`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({favourite:!job.favourite})});
    jobs = jobs.map(item => item.id === updated.id ? updated : item);
    notice(updated.favourite ? 'Added to favourites.' : 'Removed from favourites.');
  } catch (error) { notice(error.message); }
  finally { busy = false; render(); }
}
async function load() {
  if (busy) return;
  $('#refresh').disabled = true;
  try { jobs = await request('/api/jobs'); render(); }
  catch (error) { notice('Could not load jobs. Check the Python app is running, then refresh.'); }
  finally { $('#refresh').disabled = false; }
}
$('#refresh').onclick = load;
for (const id of ['#search', '#filter', '#sort']) $(id).addEventListener('input', render);
load();
