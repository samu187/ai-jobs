import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import SavedJobsView from './SavedJobsView';
import FindMatchView from './FindMatchView';
import {request} from './model';

function App() {
  const [view,setView]=useState('saved'), [jobs,setJobs]=useState([]), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  const pending=useRef(false), loadingRef=useRef(false), timer=useRef(null);
  const notify=text=>{setMessage(text); clearTimeout(timer.current); timer.current=setTimeout(()=>setMessage(''),6000);};
  async function load() {
    if (pending.current||loadingRef.current) return;
    loadingRef.current=true; setLoading(true);
    try {setJobs(await request('/api/jobs'));}
    catch {notify('Could not load jobs. Check the Python app is running, then refresh.');}
    finally {loadingRef.current=false; setLoading(false);}
  }
  useEffect(()=>{load(); return ()=>clearTimeout(timer.current);},[]);
  async function update(job, field, body) {
    if (pending.current||loadingRef.current) return false;
    pending.current=true; setBusy(true);
    try {
      const updated=await request(`/api/jobs/${job.id}/${field}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      setJobs(items=>items.map(item=>item.id===updated.id?updated:item));
      notify(field==='status'?`Marked as ${updated.status}.`:updated.favourite?'Added to favourites.':'Removed from favourites.');
      return true;
    } catch(error) {notify(error.message); return false;}
    finally {pending.current=false; setBusy(false);}
  }
  return <>
    <header className="topbar"><div className="topbar-left"><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">ai.</span> Job tracker</a>
      <nav className="view-nav" aria-label="Workspace views">
        <button id="saved-tab" aria-current={view==='saved'?'page':undefined} aria-controls="saved-panel" onClick={()=>setView('saved')}>Your Saved Jobs</button>
        <button id="match-tab" aria-current={view==='match'?'page':undefined} aria-controls="match-panel" onClick={()=>setView('match')}>Find a new Match <span className="nav-heart" aria-hidden="true">♥</span></button>
      </nav></div><button id="refresh" className="quiet" disabled={loading||busy} onClick={load}>↻ Refresh jobs</button>
    </header>
    <SavedJobsView active={view==='saved'} jobs={jobs} loading={loading} busy={busy||loading} update={update} notify={notify}/>
    {view==='match'&&<FindMatchView/>}
    <div id="message" role="status" aria-live="polite" hidden={!message}>{message}</div>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
