// The history is browsing history, not an undo stack: saved decisions stay saved.
export const emptyDeck = {queue:[], history:[], index:0, seen:[]};
export function shuffle(ids, random=Math.random) {
  const result=[...ids];
  for(let i=result.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
function draw(state) {
  if(state.index<state.history.length || !state.queue.length) return state;
  const [id,...queue]=state.queue;
  return {...state,queue,history:[...state.history,id]};
}
export function deckReducer(state,action) {
  switch(action.type) {
    case 'sync': {
      const available=new Set(action.ids);
      const added=action.ids.filter(id=>!state.seen.includes(id));
      return draw({...state,queue:[...state.queue.filter(id=>available.has(id)),...added],seen:[...state.seen,...added]});
    }
    case 'next':
      return draw({...state,index:Math.min(state.index+1,state.history.length)});
    case 'back':
      return {...state,index:Math.max(0,state.index-1)};
    case 'restart':
      return draw({...emptyDeck,queue:action.ids,seen:action.ids});
    default: return state;
  }
}
