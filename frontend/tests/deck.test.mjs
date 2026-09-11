import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deckReducer,emptyDeck,shuffle} from '../deck.js';
test('a shuffled deck contains each candidate exactly once without changing the source',()=>{
  const ids=[1,2,3,4];
  const result=shuffle(ids,()=>0);
  assert.deepEqual([...result].sort(),ids);
  assert.notDeepEqual(result,ids);
  assert.deepEqual(ids,[1,2,3,4]);
});
test('skip, back and forward preserve the history and end cleanly',()=>{
  let deck=deckReducer(emptyDeck,{type:'sync',ids:[2,1]});
  assert.equal(deck.history[deck.index],2);
  deck=deckReducer(deck,{type:'next'});
  assert.equal(deck.history[deck.index],1);
  deck=deckReducer(deck,{type:'back'});
  assert.equal(deck.history[deck.index],2);
  deck=deckReducer(deck,{type:'next'});
  deck=deckReducer(deck,{type:'next'});
  assert.equal(deck.history[deck.index],undefined);
  assert.equal(deckReducer(deck,{type:'back'}).history[0],2);
  assert.equal(deckReducer(deck,{type:'sync',ids:[2,1]}).history[deck.index],undefined);
});
test('refresh preserves the current role and prunes decided queued roles',()=>{
  let deck=deckReducer(emptyDeck,{type:'sync',ids:[1,2,3]});
  deck=deckReducer(deck,{type:'sync',ids:[3,4]});
  assert.equal(deck.history[deck.index],1);
  assert.deepEqual(deck.queue,[3,4]);
  deck=deckReducer(deck,{type:'next'});
  assert.equal(deck.history[deck.index],3);
  deck=deckReducer(deck,{type:'restart',ids:[4]});
  assert.deepEqual(deck.history,[4]);
});
