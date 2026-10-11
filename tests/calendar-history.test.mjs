import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFromCsv} from '../lib/calendar-history.js';

test('2026 history uses column H, combines same-day categories, and marks skipped days as rest',()=>{
 const csv='A,B,C,D,E,F,G,H\n,10月1日,,,,,,雑談\n,10月1日,,,,,,7 Days to Die\n,10月3日,,,,,,Airport Baggage Simulator\n';
 assert.deepEqual(historyFromCsv(csv),{
  '2026-10-01':{kind:'game',text:'雑談 / 7 Days to Die'},
  '2026-10-02':{kind:'rest',text:''},
  '2026-10-03':{kind:'game',text:'Airport Baggage Simulator'}
 });
});

test('quoted commas in stream titles do not move the category column',()=>{
 const csv='A,B,C,D,E,F,G,H\n,10月1日,,,,,"Title, with comma",雑談\n';
 assert.deepEqual(historyFromCsv(csv)['2026-10-01'],{kind:'chat',text:'雑談'});
});
