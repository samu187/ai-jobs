import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterJobs,scoreClass,statusOptions,orderOptions} from './model.js';
test('scores change bands at 60 and 80',()=>{
  assert.deepEqual([0,59,60,79,80,100].map(scoreClass),['score-low','score-low','score-medium','score-medium','score-high','score-high']);
});
test('filtering and ordering handle unknown dates, ties, and hidden statuses',()=>{
  const jobs=[
    {id:1,title:'Analyst',company:'One',platform:'Reed',status:'review',posted_at:null,ai_match_score:90},
    {id:2,title:'Analyst',company:'Two',platform:'Reed',status:'review',posted_at:'2026-09-10',ai_match_score:70},
    {id:3,title:'Lead',company:'One',platform:'Reed',status:'applied',posted_at:'2026-09-11',ai_match_score:80},
    {id:4,title:'Analyst',company:'One',platform:'Reed',status:'review',posted_at:'2026-09-10',ai_match_score:70},
  ];
  assert.deepEqual(filterJobs(jobs,'','review','date').map(j=>j.id),[4,2,1]);
  assert.deepEqual(filterJobs(jobs,'','review','score').map(j=>j.id),[1,4,2]);
  assert.deepEqual(filterJobs(jobs,'ONE','all','date').map(j=>j.id),[3,4,1]);
  assert.equal(jobs[0].id,1);
});
test('each menu choice has a unique shortcut',()=>{
  const choices=[...statusOptions,...orderOptions];
  assert.equal(new Set(choices.map(o=>o.key)).size,choices.length);
});
