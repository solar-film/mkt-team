const puppeteer = require('puppeteer');
const http = require('http');

async function testPage(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle0' });
  
  // Wait a bit just in case
  await new Promise(r => setTimeout(r, 2000));
  
  const content = await page.content();
  if (content.includes("This page couldn't load")) {
    console.log("CRASH REPRODUCED!");
  } else {
    console.log("NO CRASH DETECTED.");
  }
  
  await browser.close();
}

// We will test the production server deployed on Vercel
testPage('https://mkt-team.vercel.app/kpis');
