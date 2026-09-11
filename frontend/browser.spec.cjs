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
    await route.fulfill({body:await fs.readFile(path.join('src/jobs/static',file)),contentType:type});
  });
  await page.goto('http://127.0.0.1:5059/');
});
test('defaults, scores, every menu shortcut, and menu keyboard navigation',async({page})=>{
  await expect(page.locator('.job-card')).toHaveCount(3);
  await expect(page.locator('.job-title')).toHaveText('Finance Analyst');
  await expect(page.locator('.score')).toHaveClass(/score-medium/);
  for(const [key,label,count] of [['A','Accepted',0],['P','Applied',1],['I','Interviewing',0],['X','Rejected',0],['L','All statuses',4],['R','Review',3]]){
    await page.keyboard.press('Alt+'+key.toLowerCase());
    await expect(page.getByRole('button',{name:'Filter by status: '+label,exact:true})).toBeVisible();
    await expect(page.locator('.job-card')).toHaveCount(count);
  }
  await page.keyboard.press('Alt+l');await page.keyboard.press('Alt+s');
  await expect(page.locator('.job-card').first()).toContainText('Project Analyst');
  await page.keyboard.press('Alt+r');await page.keyboard.press('Alt+d');
  await page.getByRole('button',{name:'Filter by status: Review',exact:true}).click();
  await expect(page.getByRole('menuitemradio',{name:'Review',exact:false})).toBeFocused();
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Filter by status: Accepted',exact:true})).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button',{name:'Order by: Newest first',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Order by: Newest first',exact:true})).toBeFocused();
  await page.keyboard.press('Alt+r');
  await page.keyboard.press('Alt+Space');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('searchbox').fill('Operations');
  await expect(page.locator('.job-card')).toHaveCount(1);
  await expect(page.locator('.score')).toHaveClass(/score-low/);
});
test('views preserve saved state, cards navigate, favourite and status updates work',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await expect(page.locator('.job-card')).toHaveCount(3);
  await page.locator('.job-card').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.job-title')).toHaveText('Business Analyst');
  await expect(page.locator('.job-card.selected')).toBeFocused();
  await page.getByRole('button',{name:'Add to favourites',exact:true}).click();
  await expect(page.locator('.job-card.selected')).toHaveClass(/favourite/);
  await page.getByRole('button',{name:'Find a new Match',exact:false}).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.getByText('Coming soon', {exact:true})).toBeVisible();
  await page.keyboard.press('Alt+p');
  await page.getByRole('button',{name:'Your Saved Jobs',exact:true}).click();
  await expect(page.locator('.job-title')).toHaveText('Business Analyst');
  await page.getByRole('group',{name:'Job state',exact:true}).getByRole('button',{name:'Accepted',exact:true}).click();
  await expect(page.locator('.job-card')).toHaveCount(2);
  await page.keyboard.press('Alt+a');
  await expect(page.locator('.job-title')).toHaveText('Business Analyst');
  expect(errors).toEqual([]);
});
test('menu placement and mobile layout',async({page},testInfo)=>{
  await page.getByRole('button',{name:'Filter by status: Review',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('desktop.png')});
  await page.locator('.job-title').click();
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
  await page.getByRole('button',{name:'Apply ↗',exact:true}).click();
  await expect(page.locator('.job-card')).toHaveCount(2);
  expect(await page.evaluate(()=>window.openedListing)).toBe('https://example.com/job/3');
  expect(await page.evaluate(()=>window.testPopup.opener)).toBe(null);
  await page.route('**/api/jobs/*/status',route=>route.fulfill({status:500,json:{error:'Could not save test job.'}}));
  await page.getByRole('button',{name:'Apply ↗',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Could not save test job.');
  expect(await page.evaluate(()=>window.testPopup.closed)).toBe(true);
  await expect(page.locator('.job-card')).toHaveCount(2);
  await expect(page.locator('.job-title')).toHaveText('Business Analyst');
});
