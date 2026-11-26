import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAutoDashboard,parseNumber,parseDate,dayToIso,detectAutoCurrency} from '../src/engines/auto/auto-dashboards';

const cols=(rows:Record<string,unknown>[])=>Object.keys(rows[0]).map(name=>({name,dataType:'TEXT'}));
const value=(r:ReturnType<typeof computeAutoDashboard>,key:string)=>r.metrics.find(m=>m.key===key)?.value;

test('numbers from accounting and ad exports are parsed',()=>{
 assert.equal(parseNumber(' $ 32,370.00 '),32370);
 assert.equal(parseNumber(' $ -   '),0);
 assert.equal(parseNumber('(1,200)'),-1200);
 assert.equal(parseNumber('$ (4,533.75)'),-4533.75);
 assert.equal(parseNumber('-$5.5'),-5.5);
 assert.equal(parseNumber('Rs. 1,500'),1500);
 assert.equal(parseNumber('12%'),12);
 assert.equal(parseNumber('1.234,56',true),1234.56);
 assert.equal(parseNumber('n/a'),null);
});

test('dates in common formats are parsed',()=>{
 const iso=(v:string,dayFirst=false)=>{const d=parseDate(v,dayFirst);return d==null?null:dayToIso(d);};
 assert.equal(iso('6/1/2014'),'2014-06-01');
 assert.equal(iso('25/03/2024',true),'2024-03-25');
 assert.equal(iso('2024-03-05T10:00:00Z'),'2024-03-05');
 assert.equal(iso('Mar 5, 2024'),'2024-03-05');
 assert.equal(iso('5-Mar-2024'),'2024-03-05');
 assert.equal(iso('2/30/2024'),null);
});

test('finance: revenue, cost, profit and margin from typical column names',()=>{
 const rows=[
  {Segment:'Government',Date:'1/1/2014',Sales:' $ 1,000.00 ',COGS:' $ 600.00 ',Profit:' $ 400.00 ',Discounts:' $ -   '},
  {Segment:'Enterprise',Date:'2/1/2014',Sales:' $ 3,000.00 ',COGS:' $ 2,100.00 ',Profit:' $ 900.00 ',Discounts:' $ 50.00 '},
  {Segment:'Government',Date:'3/1/2014',Sales:' $ 1,000.00 ',COGS:' $ 1,100.00 ',Profit:' $ (100.00)',Discounts:' $ 10.00 '},
 ];
 const r=computeAutoDashboard({category:'FINANCE',columns:cols(rows),rows});
 assert.equal(value(r,'REVENUE'),5000);
 assert.equal(value(r,'COGS'),3800);
 assert.equal(value(r,'PROFIT'),1200);
 assert.equal(value(r,'MARGIN'),0.24);
 assert.equal(value(r,'DISCOUNTS'),60);
 assert.equal(r.trend?.grain,'DAY');
 assert.equal(r.breakdown?.field,'Segment');
 assert.match(r.metrics.find(m=>m.key==='REVENUE')!.source,/"Sales" column/);
});

test('finance: profit is calculated when there is no profit column',()=>{
 const rows=[{Revenue:'100',Expenses:'30','Cost of goods sold':'20'},{Revenue:'200',Expenses:'50','Cost of goods sold':'40'}];
 const r=computeAutoDashboard({category:'FINANCE',columns:cols(rows),rows});
 assert.equal(value(r,'PROFIT'),160);
 assert.equal(value(r,'EXPENSE_RATIO'),80/300);
});

test('marketing: derived rates and return on spend; per-unit columns are not treated as spend',()=>{
 const rows=[
  {date:'2026-03-01',channel:'Search',budget:'1000','cost_per_click':'2',impressions:'10000',clicks:'500',conversions:'50',conversion_value:'5000'},
  {date:'2026-03-02',channel:'Social',budget:'500','cost_per_click':'1',impressions:'20000',clicks:'500',conversions:'10',conversion_value:'1000'},
 ];
 const r=computeAutoDashboard({category:'MARKETING',columns:cols(rows),rows});
 assert.equal(value(r,'SPEND'),1500);
 assert.equal(value(r,'CTR'),1000/30000);
 assert.equal(value(r,'CPC'),1.5);
 assert.equal(value(r,'CPA'),25);
 assert.equal(value(r,'ROAS'),4);
 assert.equal(r.breakdown?.field,'channel');
 assert.ok(r.missing.some(m=>m.key==='LEADS'));
});

test('operations: averages for times and rates given in percent points',()=>{
 const rows=[
  {Carrier:'A','Order quantities':'10','Lead times':'4','Shipping costs':'5','Defect rates':'2.0','Stock levels':'40',Availability:'90'},
  {Carrier:'B','Order quantities':'30','Lead times':'8','Shipping costs':'15','Defect rates':'4.0','Stock levels':'60',Availability:'80'},
 ];
 const r=computeAutoDashboard({category:'OPERATIONS',columns:cols(rows),rows});
 assert.equal(value(r,'VOLUME'),40);
 assert.equal(value(r,'LEAD_TIME'),6);
 assert.equal(value(r,'SHIPPING_COST'),20);
 assert.equal(value(r,'DEFECT_RATE_COLUMN'),0.03);
 assert.equal(value(r,'STOCK'),50);
 assert.ok(r.notes.some(n=>/No date column/.test(n)));
});

test('date range compares with the previous period of the same length, and filters apply',()=>{
 const rows=[
  {Date:'2026-01-10',Region:'North',Revenue:'100'},{Date:'2026-01-20',Region:'South',Revenue:'50'},
  {Date:'2026-02-10',Region:'North',Revenue:'150'},{Date:'2026-02-20',Region:'South',Revenue:'90'},
 ];
 const r=computeAutoDashboard({category:'FINANCE',columns:cols(rows),rows,query:{start:'2026-02-01',end:'2026-02-28'}});
 assert.equal(value(r,'REVENUE'),240);
 assert.equal(r.metrics.find(m=>m.key==='REVENUE')!.previous,150);
 const north=computeAutoDashboard({category:'FINANCE',columns:cols(rows),rows,query:{filterField:'Region',filterValue:'North'}});
 assert.equal(value(north,'REVENUE'),250);
});

test('customer settings change card order and the breakdown column',()=>{
 const rows=[{Channel:'A',Campaign:'X',Spend:'10',Clicks:'5'},{Channel:'B',Campaign:'Y',Spend:'20',Clicks:'5'}];
 const r=computeAutoDashboard({category:'MARKETING',columns:cols(rows),rows,settings:{order:['CLICKS','SPEND'],breakdown:'Campaign'}});
 assert.deepEqual(r.metrics.slice(0,2).map(m=>m.key),['CLICKS','SPEND']);
 assert.equal(r.breakdown?.field,'Campaign');
});

test('unrecognised data produces a helpful note instead of empty charts',()=>{
 const rows=[{Name:'A',Colour:'red'},{Name:'B',Colour:'blue'}];
 const r=computeAutoDashboard({category:'MARKETING',columns:cols(rows),rows});
 assert.equal(r.metrics.length,0);
 assert.ok(r.notes.some(n=>/could not find/.test(n)));
});

test('currency is detected from money columns',()=>{
 assert.equal(detectAutoCurrency([{Sales:'€ 1.200'}],['Sales']),'EUR');
 assert.equal(detectAutoCurrency([{Sales:'Rs. 1,200'}],['Sales']),'PKR');
 assert.equal(detectAutoCurrency([{Sales:'1200'}],['Sales'],'GBP'),'GBP');
});

test('refunded, cancelled and pending orders are not counted, and the note says so',()=>{
 const rows=[{created_at:'2026-09-01',financial_status:'PAID',total_amount_major:'100'},{created_at:'2026-09-02',financial_status:'REFUNDED',total_amount_major:'50'},{created_at:'2026-09-03',financial_status:'PENDING',total_amount_major:'25'},{created_at:'2026-09-04',financial_status:'PARTIALLY_REFUNDED',total_amount_major:'40'}];
 const r=computeAutoDashboard({category:'FINANCE',columns:cols(rows),rows});
 assert.equal(value(r,'REVENUE'),140);
 assert.ok(r.notes.some(n=>/2 rows marked as refunded/.test(n)));
});
