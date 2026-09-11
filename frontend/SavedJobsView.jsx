import React, {useEffect, useMemo, useRef, useState} from 'react';
import Sidebar from './Sidebar';
import JobDetail from './JobDetail';
import {filterJobs, statusOptions, orderOptions} from './model';
export default function SavedJobsView({active, jobs, loading, busy, update, notify}) {
  const [search,setSearch]=useState(''), [status,setStatus]=useState('review'), [order,setOrder]=useState('date');
  const [selectedId,setSelectedId]=useState(null), [menu,setMenu]=useState(null);
  const searchRef=useRef(null), root=useRef(null), moveFocus=useRef(false);
  const visible=useMemo(()=>filterJobs(jobs,search,status,order),[jobs,search,status,order]);
  const job=visible.find(job=>job.id===selectedId)||visible[0]||null;
  useEffect(()=>{setSelectedId(job?.id??null);},[job?.id]);
  useEffect(()=>{
    if (!active) setMenu(null);
    if (active && moveFocus.current) {
      moveFocus.current=false;
      const card=root.current.querySelector('.job-card.selected');
      card?.focus({preventScroll:true}); card?.scrollIntoView({block:'nearest'});
    }
  });
  useEffect(()=>{
    if (!active) return;
    const onKeyDown=event=>{
      if (event.isComposing||event.metaKey||event.ctrlKey||event.shiftKey) return;
      if (event.altKey) {
        if (event.code==='Space') {event.preventDefault(); setMenu(null); searchRef.current.focus(); searchRef.current.select(); return;}
        const statusChoice=statusOptions.find(o=>'Key'+o.key===event.code);
        const orderChoice=orderOptions.find(o=>'Key'+o.key===event.code);
        if (statusChoice||orderChoice) {
          event.preventDefault();
          if (statusChoice) setStatus(statusChoice.value);
          if (orderChoice) setOrder(orderChoice.value);
          if (menu) root.current.querySelector('.filter-trigger.open')?.focus();
          setMenu(null);
        }
        return;
      }
      if (menu||busy||!visible.length||!['ArrowDown','ArrowUp'].includes(event.key)) return;
      if (event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
      event.preventDefault();
      const index=visible.findIndex(item=>item.id===job?.id);
      const next=Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowDown'?1:-1)));
      if (visible[next].id===job?.id) {
        root.current.querySelector('.job-card.selected')?.focus({preventScroll:true});
      } else {moveFocus.current=true; setSelectedId(visible[next].id);}
    };
    document.addEventListener('keydown',onKeyDown);
    return ()=>document.removeEventListener('keydown',onKeyDown);
  },[active,visible,job?.id,busy,menu]);
  return <main ref={root} className="workspace" id="saved-panel" aria-labelledby="saved-tab" hidden={!active}>
    <Sidebar jobs={visible} selectedId={job?.id} onSelect={id=>{if(!busy)setSelectedId(id);}} search={search} setSearch={setSearch} searchRef={searchRef}
      status={status} setStatus={setStatus} order={order} setOrder={setOrder} menu={menu} setMenu={setMenu} loading={loading}/>
    <JobDetail job={job} hasJobs={Boolean(jobs.length)} loading={loading} busy={busy} update={update} notify={notify}/>
  </main>;
}
