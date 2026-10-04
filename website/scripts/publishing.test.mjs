import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {publishTime,publishedArticles,selectArticles} from '../public/publishing.js';
const entries=JSON.parse(await fs.readFile(new URL('../content/articles.json',import.meta.url)));
const batch=entries.filter(a=>a.date>='2026-09-22'&&a.date<='2026-09-26');
const dailyThree=entries.filter(a=>a.date>='2026-09-27'&&a.date<='2026-10-03');
test('every scheduled day contains five music articles and one illustrated childcare article',()=>{
 assert.equal(batch.length,30);
 for(let day=22;day<=26;day++){
  const daily=batch.filter(a=>a.date===`2026-09-${day}`);assert.equal(daily.length,6);
  assert.equal(daily.filter(a=>a.category==='育兒與照顧').length,1);
  assert.equal(new Set(daily.map(a=>a.publishAt)).size,6);
 }
});
test('new schedule contains one morning video, one instrument post and one childcare comic per day',()=>{
 assert.equal(dailyThree.length,21);
 for(let cursor=new Date('2026-09-27T00:00:00Z');cursor<=new Date('2026-10-03T00:00:00Z');cursor.setUTCDate(cursor.getUTCDate()+1)){
  const date=cursor.toISOString().slice(0,10);
  const daily=dailyThree.filter(a=>a.date===date);
  assert.equal(daily.length,3);
  assert.deepEqual(daily.map(a=>a.publishAt.slice(11,16)).sort(),['08:00','16:00','21:00']);
  assert.equal(daily.filter(a=>a.category==='育兒與照顧').length,1);
  assert.equal(daily.filter(a=>a.video).length,1);
 }
});
test('family comic schedule stops after October 3 and the twice-daily video schedule begins October 5',()=>{
 const oct4=entries.filter(a=>a.date==='2026-10-04');
 const oct5=entries.filter(a=>a.date==='2026-10-05');
 assert.deepEqual(oct4.map(a=>a.publishAt.slice(11,16)).sort(),['08:00','16:00','21:00']);
 assert.equal(oct4.filter(a=>a.category==='育兒與照顧').length,0);
 assert.equal(oct4.find(a=>a.publishAt.includes('T21:00')).video,'2026-10-04-yds-digital-sax.mp4');
 assert.deepEqual(oct5.map(a=>a.publishAt.slice(11,16)).sort(),['08:00','21:00']);
 assert.equal(oct5.filter(a=>a.category==='育兒與照顧').length,0);
 assert.equal(oct5.filter(a=>a.video).length,2);
 assert.equal(oct5.find(a=>a.publishAt.includes('T08:00')).video,'2026-10-05-phoenix-hybrid.mp4');
 assert.equal(oct5.find(a=>a.publishAt.includes('T21:00')).video,'2026-10-05-volt-gen2.mp4');
});
test('Taipei boundary is inclusive and matches the same UTC instant',()=>{
 assert.equal(publishedArticles(batch,Date.parse('2026-09-22T07:59:59.999+08:00')).length,0);
 assert.equal(publishedArticles(batch,Date.parse('2026-09-22T08:00:00+08:00')).length,1);
 assert.equal(publishedArticles(batch,Date.parse('2026-09-22T00:00:00Z')).length,1);
 for(let day=22;day<=26;day++)assert.equal(publishedArticles(batch,Date.parse(`2026-09-${day}T23:59:59+08:00`)).length,(day-21)*6);
});
test('future dates never enter search, categories, pagination or sorting',()=>{
 const due=publishedArticles(entries,Date.parse('2026-09-22T23:59:59+08:00'));
 assert.equal(due.length,14);assert.equal(due[0].slug,'childcare-waitlist');
 assert.equal(selectArticles(due,{query:'MiniFreak'}).total,0);
 assert.equal(selectArticles(due,{date:'2026-09-23'}).total,0);
 assert.equal(selectArticles(due,{date:'2026-09-22'}).total,6);
 assert.equal(selectArticles(due,{page:2}).items.length,2);
 assert.equal(selectArticles(due,{page:200}).page,2);
});
test('missing legacy time defaults to Taipei midnight and offset-less input fails',()=>{
 assert.equal(publishTime({date:'2026-09-20'}),Date.parse('2026-09-19T16:00:00Z'));
 assert.throws(()=>publishTime({publishAt:'2026-09-22T08:00:00'}));
 assert.throws(()=>publishTime({publishAt:'not-a-date'}));
 assert.throws(()=>publishTime({publishAt:'2026-02-30T08:00:00+08:00'}));
});
test('clock moving backwards removes already visible scheduled entries',()=>{
 assert.equal(publishedArticles(batch,Date.parse('2026-09-26T20:00:00+08:00')).length,30);
 assert.equal(publishedArticles(batch,Date.parse('2026-09-21T20:00:00+08:00')).length,0);
});
