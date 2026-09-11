import React, {useState} from 'react';

const captions = {
  reject: ["No thanks!", "Nope!", "I'm overqualified!", "Their loss!", "Next, please!", "Too iconic for this!"],
  apply: ["Let's go!", "Here for the money!", "They need my genius!", "Time to get paid!", "Future me says yes!"],
  interview: ["Let's charm them!", "Meet the talent!", "Time to impress!", "Cue my entrance!"],
  withdraw: ["Plot twist: nope!", "Their loss!", "I've seen enough!", "On to better things!"],
};
const pick = choices => choices[Math.floor(Math.random()*choices.length)];

function ActionButton({kind, symbol, label, caption, busy, onClick}) {
  return <button className={'decision-button '+kind+'-action'} disabled={busy}
    aria-label={label+': '+caption} title={label} onClick={onClick}>
    <span className="decision-symbol" aria-hidden="true">{symbol}</span>
    <span className="decision-copy"><small>{label}</small><strong>{caption}</strong></span>
  </button>;
}

export default function JobActions({job, busy, update, notify, onBack, onSkip, canGoBack}) {
  const [labels] = useState(()=>Object.fromEntries(Object.entries(captions).map(([key,choices])=>[key,pick(choices)])));
  async function apply() {
    const tab = window.open('about:blank', '_blank');
    if (!tab) {notify('Allow pop-ups for this app, then click Apply again.'); return;}
    tab.opener = null;
    if (await update(job, 'status', {status:'applied'})) tab.location.replace(job.url);
    else tab.close();
  }
  const rejected=job.status==='rejected', progressed=['applied','interviewing'].includes(job.status);
  return <footer className={"actions job-actions"+(onSkip?" deck-actions":"")}>
    {job.status!=='review'&&<div className="action-context"><span className={'badge '+job.status}>{job.status}</span>
      <p>{rejected?'Changed your mind?':job.status==='applied'?'Next stop: the interview.':'Time to impress them.'}</p></div>}
    <div className="action-buttons" role="group" aria-label="Job actions">
      {onBack&&<ActionButton kind="back" symbol="↶" label="Back" caption="Previous role" busy={busy||!canGoBack} onClick={onBack}/>}
      {!rejected&&<ActionButton kind="reject" symbol="✕" label="Reject" caption={progressed?labels.withdraw:labels.reject} busy={busy} onClick={()=>update(job,'status',{status:'rejected'})}/>}
      {onSkip&&<ActionButton kind="skip" symbol="↷" label="Skip" caption="Maybe later" busy={busy} onClick={onSkip}/>}
      {!progressed&&<ActionButton kind="apply" symbol="♥" label="Apply" caption={labels.apply} busy={busy} onClick={apply}/>}
      {job.status==='applied'&&<ActionButton kind="interview" symbol={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>} label="Interviewing" caption={labels.interview} busy={busy} onClick={()=>update(job,'status',{status:'interviewing'})}/>}
      {job.status==='interviewing'&&<ActionButton kind="return" symbol="↶" label="Back to applied" caption="A step back" busy={busy} onClick={()=>update(job,'status',{status:'applied'})}/>}
    </div>
  </footer>;
}
