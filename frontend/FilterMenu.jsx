import React, {useEffect, useRef} from 'react';

function Icon({kind}) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'status' ? <><path d="M4 5h16l-6 7v6l-4 2v-8z"/></> : <><path d="M7 4v16m-3-3 3 3 3-3M13 6h7M13 11h5M13 16h3"/></>}
  </svg>;
}
export default function FilterMenu({kind, label, options, value, onChange, open, onOpen}) {
  const container = useRef(null), trigger = useRef(null), menu = useRef(null);
  useEffect(() => {
    if (!open) return;
    menu.current.querySelector('[aria-checked="true"]')?.focus();
    const outside = event => { if (!container.current.contains(event.target)) onOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const close = () => { onOpen(false); trigger.current.focus(); };
  function onKeyDown(event) {
    const items = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (index+(event.key === 'ArrowDown'?1:-1)+items.length)%items.length;
      items[next].focus();
    }
  }
  return <div className="filter-menu" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) onOpen(false);
  }}>
    <button className={'filter-trigger'+(open?' open':'')} ref={trigger} aria-label={`${label}: ${options.find(o=>o.value===value).label}`} title={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={kind+'-menu'} onClick={()=>onOpen(!open)}
      onKeyDown={event=>{if (event.key==='ArrowDown') {event.preventDefault(); event.stopPropagation(); onOpen(true);}}}>
      <Icon kind={kind}/><span>{options.find(o=>o.value===value).label}</span><span className="menu-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div id={kind+'-menu'} className="filter-popover" role="menu" aria-label={label} ref={menu} onKeyDown={onKeyDown}>
      <div className="menu-label">{label}</div>
      {options.map(option=><button key={option.value} role="menuitemradio" aria-checked={value===option.value}
        aria-keyshortcuts={'Alt+'+option.key.toLowerCase()} tabIndex={-1} onClick={()=>{onChange(option.value); close();}}>
        <span className="menu-check" aria-hidden="true">{value===option.value?'✓':''}</span><span>{option.label}</span><kbd>⌥ {option.key}</kbd>
      </button>)}
    </div>}
  </div>;
}
