import React from 'react';
import {scoreClass, dateLabel} from '../model';
export default function JobCard({job, selected, onSelect}) {
  return <button className={`job-card${selected?' selected':''}${job.favourite?' favourite':''}`} aria-pressed={selected} tabIndex={selected?0:-1} onClick={onSelect}>
    <div className="card-top">{job.favourite&&<span className="card-heart" aria-label="Favourite">♥</span>}<span className="company">{job.company}</span><span className={'mini-score '+scoreClass(job.ai_match_score)}>{job.ai_match_score} match</span></div>
    <h2>{job.title}</h2><p className="summary">{job.ai_match_summary}</p>
    <div className="card-bottom"><span>{dateLabel(job.posted_at)}</span><span className={'badge '+job.status}>{job.status}</span></div>
  </button>;
}
