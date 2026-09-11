import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import SavedJobsView from './views/SavedJobsView';
import FindMatchView from './views/FindMatchView';
import {request} from './model';

function App() {
  const [view,setView]=useState('match'), [jobs,setJobs]=useState([]), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [message,setMessage]=useState('');
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
  const viewScroll=useRef({match:0,saved:0});
  function switchView(next) {
    if(next===view) return;
    viewScroll.current[view]=window.scrollY;
    setView(next);
  }
  useLayoutEffect(()=>{window.scrollTo(0,viewScroll.current[view]);},[view]);
  useEffect(()=>{
    const onKeyDown=event=>{
      if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey) return;
      if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="menu"]')) return;
      if(!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      const next=event.key==='ArrowLeft'?'match':'saved';
      event.preventDefault();
      switchView(next);
      document.getElementById(next+'-tab')?.focus({preventScroll:true});
    };
    document.addEventListener('keydown',onKeyDown);
    return ()=>document.removeEventListener('keydown',onKeyDown);
  },[view]);
  return <>
    <header className="topbar"><div className="topbar-left"><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">ai.</span> Job tracker</a>
      <nav className="view-nav" aria-label="Workspace views">
        <button id="match-tab" aria-current={view==='match'?'page':undefined} aria-controls="match-panel" onClick={()=>switchView('match')}>Find your next Role <span className="nav-heart" aria-hidden="true">♥</span></button>
        <button id="saved-tab" aria-current={view==='saved'?'page':undefined} aria-controls="saved-panel" onClick={()=>switchView('saved')}>Your Saved Jobs <svg className="nav-briefcase" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 12v3"/></svg></button>
      </nav></div><button id="refresh" className="quiet" disabled={loading||busy} onClick={load}>↻ Refresh jobs</button>
    </header>
    <SavedJobsView active={view==='saved'} jobs={jobs} loading={loading} busy={busy||loading} update={update} notify={notify}/>
    <FindMatchView active={view==='match'} jobs={jobs} loading={loading} busy={busy||loading} update={update} notify={notify}/>
    <div id="message" role="status" aria-live="polite" hidden={!message}>{message}</div>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
