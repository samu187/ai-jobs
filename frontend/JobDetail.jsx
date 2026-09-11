import React from 'react';
import {statusOptions, scoreClass, dateLabel} from './model';
export default function JobDetail({job, hasJobs, loading, busy, update, notify}) {
  if (!job) return <section className="detail" aria-label="Selected job"><div className="empty"><span className="empty-symbol">↗</span><h2>{loading?'Loading your jobs…':hasJobs?'Room for a different search.':'Your job search starts here.'}</h2><p>{hasJobs?'Try another filter or search term.':'Your saved roles and match assessments will appear here.'}</p></div></section>;
  async function apply() {
    const tab = window.open('about:blank', '_blank');
    if (!tab) {notify('Allow pop-ups for this app, then click Apply again.'); return;}
    tab.opener = null;
    if (await update(job, 'status', {status:'applied'})) tab.location.replace(job.url);
    else tab.close();
  }
  return <section className="detail" aria-label="Selected job"><article className="job-detail">
    <div className="detail-heading"><div><div className="eyebrow">{job.platform} / {job.company}</div><h2 className="job-title">{job.title}</h2></div>
      <div className="detail-corner"><button className={'favourite-button'+(job.favourite?' active':'')} aria-label={job.favourite?'Remove from favourites':'Add to favourites'} aria-pressed={Boolean(job.favourite)} disabled={busy} onClick={()=>update(job,'favourite',{favourite:!job.favourite})}>{job.favourite?'♥':'♡'}</button>
      <div className={'score '+scoreClass(job.ai_match_score)}><strong>{job.ai_match_score}</strong><span>MATCH / 100</span></div></div>
    </div>
    <div className="metadata">{[job.location||'Location not listed',job.salary||'Salary not listed',job.contract_type,job.experience_level,'Posted '+dateLabel(job.posted_at)].filter(Boolean).map((text,i)=><span key={i}>{text}</span>)}</div>
    <section className="assessment"><div className="eyebrow">AI MATCH ASSESSMENT</div><p>{job.ai_match_summary}</p></section>
    <div className="skills-grid">{[['matching_skills','What you bring','matching'],['missing_skills','Gaps to consider','missing']].map(([key,title,cls])=><section key={key}><h3>{title}</h3><div className="tags">{job[key].map((skill,i)=><span className={'tag '+cls} key={i}>{skill}</span>)}{!job[key].length&&<p className="muted">{key==='matching_skills'?'No matching skills documented.':'No specific gaps identified.'}</p>}</div></section>)}</div>
    <section className="description"><h3>About the role</h3><div className="description-text">{job.description}</div></section>
    <p className="footnote">Found {dateLabel(job.discovered_at)} · Status updated {dateLabel(job.status_changed_at)}{job.applied_at?' · Applied '+dateLabel(job.applied_at):''}</p>
  </article><footer className="actions"><div className="state-group"><div className="eyebrow">APPLICATION STATUS</div><div className="state-buttons" role="group" aria-label="Job state">
    {statusOptions.filter(o=>o.value!=='all').map(option=><button key={option.value} className={'state-button'+(job.status===option.value?' active':'')} aria-pressed={job.status===option.value} disabled={busy} onClick={()=>update(job,'status',{status:option.value})}>{option.label}</button>)}
  </div></div><button className="apply" disabled={busy} onClick={apply}>Apply ↗</button></footer></section>;
}
