import React, {useLayoutEffect, useRef} from 'react';
import JobDetail from './JobDetail';
import JobActions from './JobActions';

export default function MatchCard({job, active, busy, update, notify, onBack, onSkip, canGoBack, scrollPositions}) {
  const root=useRef(null);
  useLayoutEffect(()=>{
    if (!active) return;
    const detail=root.current.querySelector('.detail');
    detail.scrollTop=scrollPositions.current[job.id]||0;
    const save=()=>{scrollPositions.current[job.id]=detail.scrollTop;};
    detail.addEventListener('scroll',save);
    return ()=>detail.removeEventListener('scroll',save);
  },[job.id,active]);
  return <div className="match-card" ref={root}>
    <JobDetail job={job} hasJobs busy={busy} update={update} notify={notify}
      actions={<JobActions key={job.id} job={job} busy={busy} update={update} notify={notify}
        onBack={onBack} onSkip={onSkip} canGoBack={canGoBack}/>}/>
  </div>;
}
