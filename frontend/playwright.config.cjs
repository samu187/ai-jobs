const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
  testDir:'tests',
  testMatch:'browser.spec.cjs',
  workers:1,
  use:{
    headless:true,
    viewport:{width:1280,height:900},
    launchOptions: process.env.AI_JOBS_BROWSER ? {executablePath:process.env.AI_JOBS_BROWSER} : {},
  },
});
