const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const sampleJobs=()=>[59,60,79,80].map((score,i)=>({
  id:i+1,title:['Operations Analyst','Business Analyst','Finance Analyst','Project Analyst'][i],
  company:'Example company',platform:'Reed',status:i===3?'applied':'review',
  posted_at:'2026-09-'+(10+i),ai_match_score:score,matching_skills:['Analysis'],missing_skills:['Industry experience'],
  ai_match_summary:'A sample assessment for browser testing.',description:'Example duties and requirements.',
  favourite:false,url:'https://example.com/job/'+(i+1),
}));
test.beforeEach(async({page})=>{
  const jobs=sampleJobs();
  await page.route('http://127.0.0.1:5059/**',async route=>{
    const url=new URL(route.request().url()), pathname=url.pathname;
    if(pathname==='/api/jobs') return route.fulfill({json:jobs});
    const match=pathname.match(/^\/api\/jobs\/(\d+)\/(status|favourite)$/);
    if(match){
      const job=jobs.find(j=>j.id===Number(match[1]));
      Object.assign(job,route.request().postDataJSON());
      return route.fulfill({json:job});
    }
    const file=pathname==='/'?'index.html':path.basename(pathname);
    const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html';
    await route.fulfill({body:await fs.readFile(path.join(__dirname,'../../src/jobs/static',file)),contentType:type});
  });
  await page.goto('http://127.0.0.1:5059/');
  await page.getByRole('button',{name:'Your Saved Jobs',exact:true}).click();
});
test('defaults, scores, every menu shortcut, and menu keyboard navigation',async({page})=>{
  await expect(page.locator('.job-card')).toHaveCount(3);
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Finance Analyst');
  await expect(page.locator('#saved-panel .score')).toHaveClass(/score-medium/);
  for(const [key,label,count] of [['A','Applied',1],['I','Interviewing',0],['X','Rejected',0],['L','All statuses',4],['R','Review',3]]){
    await page.keyboard.press('Alt+'+key.toLowerCase());
    await expect(page.getByRole('button',{name:'Filter by status: '+label,exact:true})).toBeVisible();
    await expect(page.locator('.job-card')).toHaveCount(count);
  }
  await page.keyboard.press('Alt+l');await page.keyboard.press('Alt+s');
  await expect(page.locator('.job-card').first()).toContainText('Project Analyst');
  await page.keyboard.press('Alt+r');await page.keyboard.press('Alt+n');
  await page.getByRole('button',{name:'Filter by status: Review',exact:true}).click();
  await expect(page.getByRole('menuitemradio',{name:'Review',exact:false})).toBeFocused();
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Filter by status: Applied',exact:true})).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button',{name:'Order by: Newest first',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Order by: Newest first',exact:true})).toBeFocused();
  await page.keyboard.press('Alt+r');
  await page.keyboard.press('Alt+Space');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('searchbox').fill('Operations');
  await expect(page.locator('.job-card')).toHaveCount(1);
  await expect(page.locator('#saved-panel .score')).toHaveClass(/score-low/);
});
test('views preserve saved state, cards navigate, favourite and status updates work',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await expect(page.locator('.job-card')).toHaveCount(3);
  await page.locator('.job-card').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Business Analyst');
  await expect(page.locator('.job-card.selected')).toBeFocused();
  await page.getByRole('button',{name:'Add to favourites',exact:true}).click();
  await expect(page.locator('.job-card.selected')).toHaveClass(/favourite/);
  await page.getByRole('button',{name:'Find your next Role',exact:false}).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.getByRole('heading',{name:'One role. Your call.'})).toBeVisible();
  await page.keyboard.press('Alt+a');
  await page.getByRole('button',{name:'Your Saved Jobs',exact:true}).click();
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Business Analyst');
  await page.getByRole('button',{name:/^Reject:/}).click();
  await expect(page.locator('.job-card')).toHaveCount(2);
  await page.keyboard.press('Alt+x');
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Business Analyst');
  expect(errors).toEqual([]);
});
test('menu placement and mobile layout',async({page},testInfo)=>{
  await page.getByRole('button',{name:'Filter by status: Review',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('desktop.png')});
  await page.locator('#saved-panel .job-title').click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Order by: Newest first',exact:true}).click();
  const bounds=await page.getByRole('menu').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
});
test('Apply opens a listing only after saving; failures keep the current job',async({page})=>{
  await page.evaluate(()=>{
    window.open=()=>window.testPopup={opener:window,closed:false,location:{replace(url){window.openedListing=url;}},close(){this.closed=true;}};
  });
  await expect(page.locator('.job-card')).toHaveCount(3);
  await page.getByRole('button',{name:/^Apply:/}).click();
  await expect(page.locator('.job-card')).toHaveCount(2);
  expect(await page.evaluate(()=>window.openedListing)).toBe('https://example.com/job/3');
  expect(await page.evaluate(()=>window.testPopup.opener)).toBe(null);
  await page.route('**/api/jobs/*/status',route=>route.fulfill({status:500,json:{error:'Could not save test job.'}}));
  await page.getByRole('button',{name:/^Apply:/}).click();
  await expect(page.getByRole('status')).toContainText('Could not save test job.');
  expect(await page.evaluate(()=>window.testPopup.closed)).toBe(true);
  await expect(page.locator('.job-card')).toHaveCount(2);
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Business Analyst');
});

test('contextual actions cover rejected, applied, interviewing and corrections',async({page})=>{
  await page.evaluate(()=>{
    window.open=()=>({opener:null,location:{replace(){}},close(){}});
  });
  await expect(page.getByRole('group',{name:'Job actions'}).getByRole('button')).toHaveCount(2);
  const caption=await page.getByRole('button',{name:/^Reject:/}).textContent();
  await page.getByRole('button',{name:'Add to favourites',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Reject:/})).toHaveText(caption);
  await page.getByRole('button',{name:/^Reject:/}).click();
  await page.keyboard.press('Alt+x');
  await expect(page.locator('#saved-panel').getByText('Changed your mind?',{exact:true})).toBeVisible();
  await expect(page.getByRole('group',{name:'Job actions'}).getByRole('button')).toHaveCount(1);
  await page.getByRole('button',{name:/^Apply:/}).click();
  await page.keyboard.press('Alt+a');
  await page.getByRole('button',{name:/Finance Analyst/}).click();
  await expect(page.getByRole('button',{name:/^Interviewing:/})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Apply:/})).toHaveCount(0);
  await page.getByRole('button',{name:/^Interviewing:/}).click();
  await page.keyboard.press('Alt+i');
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Finance Analyst');
  await page.getByRole('button',{name:/^Back to applied:/}).click();
  await page.keyboard.press('Alt+a');
  await page.getByRole('button',{name:/Finance Analyst/}).click();
  await page.getByRole('button',{name:/^Reject:/}).click();
  await page.keyboard.press('Alt+x');
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Finance Analyst');
  await expect(page.locator('#saved-panel').getByText('Changed your mind?',{exact:true})).toBeVisible();
});
test('search and job cards use subtle borders without orange focus rings',async({page})=>{
  await expect(page.locator('.job-card')).toHaveCount(3);
  await page.keyboard.press('Alt+Space');
  await expect(page.getByRole('searchbox')).toBeFocused();
  expect(await page.getByRole('searchbox').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
  await page.locator('.job-card').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.job-card.selected')).toBeFocused();
  expect(await page.locator('.job-card.selected').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
});

test('match deck skips without saving, goes back, and preserves both views',async({page},testInfo)=>{
  let patches=0, reloads=0;
  page.on('request',request=>{if(request.method()==='PATCH')patches++; if(request.method()==='GET'&&request.url().endsWith('/api/jobs'))reloads++;});
  await page.getByRole('searchbox').fill('Business');
  await page.getByRole('button',{name:'Find your next Role',exact:false}).click();
  const match=page.locator('#match-panel');
  await expect(match.locator('.job-title')).toBeVisible();
  const first=await match.locator('.job-title').textContent();
  await expect(match.getByRole('button',{name:/^Back:/})).toBeDisabled();
  await match.getByRole('button',{name:/^Skip:/}).click();
  const second=await match.locator('.job-title').textContent();
  expect(second).not.toBe(first);
  await match.getByRole('button',{name:/^Back:/}).click();
  await expect(match.locator('.job-title')).toHaveText(first);
  expect(patches).toBe(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('searchbox')).toHaveValue('Business');
  await expect(page.locator('#saved-panel .job-title')).toHaveText('Business Analyst');
  await page.getByRole('searchbox').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#saved-panel')).toBeVisible();
  await page.getByRole('button',{name:'Your Saved Jobs',exact:true}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(match.locator('.job-title')).toHaveText(first);
  const rects=await match.locator('.decision-button').evaluateAll(buttons=>buttons.map(b=>({width:b.offsetWidth,height:b.offsetHeight})));
  expect(new Set(rects.map(r=>r.width+','+r.height)).size).toBe(1);
  await page.keyboard.press('ArrowRight');
  const savedSize=await page.locator('#saved-panel .decision-button').first().evaluate(b=>({width:b.offsetWidth,height:b.offsetHeight}));
  expect(savedSize).toEqual(rects[0]);
  await page.keyboard.press('ArrowLeft');
  expect(reloads).toBe(0);
  await page.screenshot({path:testInfo.outputPath('match-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:testInfo.outputPath('match-mobile.png'),fullPage:true});
});
test('match decisions advance only on success; history retains saved statuses',async({page})=>{
  await page.evaluate(()=>{window.open=()=>({opener:null,location:{replace(){}},close(){}});});
  await page.getByRole('button',{name:'Find your next Role',exact:false}).click();
  const match=page.locator('#match-panel');
  await expect(match.locator('.job-title')).toBeVisible();
  const first=await match.locator('.job-title').textContent();
  await page.route('**/api/jobs/*/status',route=>route.fulfill({status:500,json:{error:'Test save failure'}}));
  await match.getByRole('button',{name:/^Reject:/}).click();
  await expect(page.getByRole('status')).toContainText('Test save failure');
  await expect(match.locator('.job-title')).toHaveText(first);
  await page.unroute('**/api/jobs/*/status');
  await match.getByRole('button',{name:/^Reject:/}).click();
  await expect(match.locator('.job-title')).not.toHaveText(first);
  await match.getByRole('button',{name:/^Back:/}).click();
  await expect(match.locator('.job-title')).toHaveText(first);
  await expect(match.getByText('Changed your mind?',{exact:true})).toBeVisible();
  await match.getByRole('button',{name:/^Apply:/}).click();
  await expect(match.locator('.job-title')).not.toHaveText(first);
  await match.getByRole('button',{name:/^Back:/}).click();
  await expect(match.getByRole('button',{name:/^Interviewing:/})).toBeVisible();
});
test('skipping a full deck ends the round and permits a reshuffle',async({page})=>{
  await page.getByRole('button',{name:'Find your next Role',exact:false}).click();
  const match=page.locator('#match-panel');
  for(let i=0;i<3;i++) await match.getByRole('button',{name:/^Skip:/}).click();
  await expect(match.getByRole('heading',{name:'That’s this round.'})).toBeVisible();
  await match.getByRole('button',{name:'↻ Shuffle remaining jobs',exact:true}).click();
  await expect(match.locator('.job-title')).toBeVisible();
  await expect(match.locator('.deck-count')).toHaveText('3 in review');
});

test('match reading position survives a trip to saved jobs',async({page})=>{
  await page.route('**/api/jobs',route=>route.fulfill({json:sampleJobs().map(job=>({...job,description:'More about this role. '.repeat(500)}))}));
  await page.getByRole('button',{name:'↻ Refresh jobs',exact:true}).click();
  await page.getByRole('button',{name:'Find your next Role',exact:false}).click();
  const detail=page.locator('#match-panel .detail');
  await expect(detail.locator('.description-text')).toContainText('More about this role.');
  await detail.evaluate(el=>{el.scrollTop=300;el.dispatchEvent(new Event('scroll'));});
  await page.getByRole('button',{name:'Your Saved Jobs',exact:true}).click();
  await page.getByRole('button',{name:'Find your next Role',exact:false}).click();
  expect(await detail.evaluate(el=>el.scrollTop)).toBe(300);
});
