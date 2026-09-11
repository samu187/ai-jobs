import React from 'react';
import FilterMenu from './FilterMenu';
import JobCard from './JobCard';
import {statusOptions, orderOptions} from './model';
export default function Sidebar({jobs, selectedId, onSelect, search, setSearch, searchRef, status, setStatus, order, setOrder, menu, setMenu, loading}) {
  return <aside className="sidebar" aria-label="Job list">
    <div className="sidebar-head"><div className="eyebrow">AI-ASSESSED ROLES</div><h1>Your jobs<span id="count">{jobs.length}</span></h1><p>Find your fit. Plan your next move.</p>
      <div className="search-field"><kbd aria-hidden="true">⌥ Space</kbd><input ref={searchRef} id="search" type="search" placeholder="Search jobs…" aria-label="Search title, company or source" aria-keyshortcuts="Alt+Space" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="filter-toolbar">
        <FilterMenu kind="status" label="Filter by status" options={statusOptions} value={status} onChange={setStatus} open={menu==='status'} onOpen={open=>setMenu(open?'status':null)}/>
        <FilterMenu kind="order" label="Order by" options={orderOptions} value={order} onChange={setOrder} open={menu==='order'} onOpen={open=>setMenu(open?'order':null)}/>
      </div>
    </div>
    <div id="job-list" className="job-list" aria-busy={loading}>{jobs.map(job=><JobCard key={job.id} job={job} selected={job.id===selectedId} onSelect={()=>onSelect(job.id)}/>)}{!jobs.length&&<p className="list-empty">{loading?'Loading your jobs…':'No jobs match your filters.'}</p>}</div>
    <div className="sidebar-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> Browse jobs</span><span>Your next move.</span></div>
  </aside>;
}
