import React, {useEffect, useReducer, useRef} from 'react';
import MatchCard from '../components/MatchCard';
import {deckReducer, emptyDeck, shuffle} from '../deck';

export default function FindMatchView({active, jobs, loading, busy, update, notify}) {
  const [deck,dispatch]=useReducer(deckReducer,emptyDeck);
  const scrollPositions=useRef({});
  useEffect(()=>{
    dispatch({type:'sync',ids:shuffle(jobs.filter(job=>job.status==='review').map(job=>job.id))});
  },[jobs]);
  const job=jobs.find(job=>job.id===deck.history[deck.index]);
  const remaining=jobs.filter(job=>job.status==='review').length;
  async function decide(job,field,body) {
    const saved=await update(job,field,body);
    if (saved && field==='status') dispatch({type:'next'});
    return saved;
  }
  return <main className="find-match-view match-deck-view" id="match-panel" aria-labelledby="match-tab" hidden={!active}>
    <div className="match-deck-heading"><div><div className="eyebrow">A LITTLE CAREER CHEMISTRY</div><h1>One role. Your call.</h1></div>
      <span className="deck-count">{remaining} in review</span></div>
    {job?<MatchCard job={job} active={active} busy={busy} update={decide} notify={notify} scrollPositions={scrollPositions}
      onBack={()=>dispatch({type:'back'})} onSkip={()=>dispatch({type:'next'})} canGoBack={deck.index>0}/>
      :<div className="deck-empty"><span className="match-heart" aria-hidden="true">♡</span>
        <h2>{loading?'Finding your next card…':remaining?'That’s this round.':'You’re all caught up.'}</h2>
        <p>{loading?'Loading your saved roles.':remaining?'Skipped roles are still in Review. Give them another look whenever you like.':'New roles saved for review will appear here.'}</p>
        <div className="deck-empty-actions">
          {deck.index>0&&<button className="quiet" disabled={busy} onClick={()=>dispatch({type:'back'})}>↶ Previous role</button>}
          {remaining>0&&!loading&&<button className="quiet" disabled={busy} onClick={()=>dispatch({type:'restart',ids:shuffle(jobs.filter(job=>job.status==='review').map(job=>job.id))})}>↻ Shuffle remaining jobs</button>}
        </div>
      </div>}
    <p className="deck-hint">Skip keeps a role in Review. Back revisits it without undoing your choice.<span><kbd>←</kbd> <kbd>→</kbd> Switch views</span></p>
  </main>;
}
