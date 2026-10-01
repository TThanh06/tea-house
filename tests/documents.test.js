import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportPeriod, csvCell, revenueCsv, receiptHtml } from '../server/documents.js';

test('report dates reject impossible dates, arrays and reversed periods', () => {
  for(const query of [{from:'2026-02-30',to:'2026-03-01'},{from:['2026-01-01'],to:'2026-03-01'},{from:'2026-12-01',to:'2026-01-01'},{from:'2026-13-01',to:'2026-13-03'}]){
    assert.throws(()=>reportPeriod(query));
  }
  const p=reportPeriod({from:'2024-02-29',to:'2024-02-29'});
  assert.equal(p.start,'2024-02-28T17:00:00.000Z');
  assert.equal(p.end,'2024-02-29T16:59:59.999Z');
});
test('default report period uses Vietnam local date across midnight',()=>{
  const p=reportPeriod({},Date.parse('2026-10-01T18:00:00Z'));
  assert.equal(p.to,'2026-10-02');
});
test('CSV quotes text and neutralizes formulas while keeping monetary cells numeric',()=>{
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
  for(const value of ['=1+1',' +SUM(A1)','@cmd','-cmd','\t=1+1'])assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell(103000),'103000');
});
const sample={id:7,recipient:'<script>alert(1)</script>',phone:'0901234567',address:'A & B',delivery_type:'pickup',status:'completed',paid:1,created_at:'2026-10-01T10:00:00.000Z',completed_at:'2026-10-01T10:30:00.000Z',subtotal:98000,discount:10000,delivery_fee:0,total:88000,coupon_code:'CHAO10',note:'<img onerror="alert(1)" src=x>'};
test('receipt escapes user text and preserves order snapshot and totals',()=>{
  const html=receiptHtml(sample,[{product_name:'Trà sữa cũ',quantity:2,unit_price:49000,size:'L',sugar:50,ice:'less',toppings_json:'[{"name":"<b>trân châu</b>"}]',note:'"test"'}]);
  assert.ok(html.includes('TH00007'));assert.ok(html.includes('88.000đ'));assert.ok(html.includes('Trà sữa cũ'));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img onerror'));
  assert.ok(html.includes('ĐÃ THANH TOÁN TIỀN MẶT'));
});
test('CSV has UTF-8 BOM, matching total row and a valid empty report',()=>{
  const csv=revenueCsv([sample]);assert.equal(csv.charCodeAt(0),0xfeff);
  assert.ok(csv.includes('"TH00007"'));assert.ok(csv.endsWith('98000,10000,0,88000\r\n'));
  assert.ok(revenueCsv([]).endsWith('0,0,0,0\r\n'));
});
