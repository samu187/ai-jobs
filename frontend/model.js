export const statusOptions = [
  {value:'review', label:'Review', key:'R'},
  {value:'applied', label:'Applied', key:'A'},
  {value:'interviewing', label:'Interviewing', key:'I'},
  {value:'rejected', label:'Rejected', key:'X'},
  {value:'all', label:'All statuses', key:'L'},
];
export const orderOptions = [
  {value:'date', label:'Newest first', key:'N'},
  {value:'score', label:'Best match', key:'S'},
];
export const scoreClass = score => score >= 80 ? 'score-high' : score >= 60 ? 'score-medium' : 'score-low';
export const dateLabel = value => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}) : 'Date unknown';
export function filterJobs(jobs, search, status, order) {
  const term = search.toLowerCase();
  return jobs.filter(job => (status === 'all' || job.status === status) && `${job.title} ${job.company} ${job.platform}`.toLowerCase().includes(term))
    .sort((a,b) => order === 'score' ? b.ai_match_score-a.ai_match_score || b.id-a.id : (b.posted_at || '').localeCompare(a.posted_at || '') || b.id-a.id);
}
export async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Unable to save. Please try again.');
  }
  return response.json();
}
