/**
 * Averidi automatic dashboards for Marketing, Finance and Operations.
 *
 * Customers bring data from many tools and industries, so column names vary ("Spend", "Amount spent",
 * "Cost"; "Lead time", "Lead days"). This engine recognises common business columns by name and content,
 * calculates the standard metrics for each dashboard type, and reports exactly which column fed each
 * metric so the customer can see how every number was produced. Metrics whose inputs are missing are
 * left out rather than guessed.
 */

export type AutoCategory='MARKETING'|'FINANCE'|'OPERATIONS';
export type AutoFormat='CURRENCY'|'NUMBER'|'PERCENT'|'DAYS'|'HOURS'|'MULTIPLE';
export type AutoCell=string|number|boolean|null|undefined;
export type AutoRow=Record<string,AutoCell>;
export type AutoColumn={name:string;dataType:string};

type BaseMetric={kind:'base';key:string;label:string;patterns:RegExp[];exclude?:RegExp[];agg:'SUM'|'AVG';format:AutoFormat;better:'UP'|'DOWN';rate?:boolean};
type RatioMetric={kind:'ratio';key:string;label:string;num:string;den:string;format:AutoFormat;better:'UP'|'DOWN';explain:string};
type DiffMetric={kind:'diff';key:string;label:string;plus:string;minus:string[];format:AutoFormat;better:'UP'|'DOWN';explain:string};
type MetricSpec=BaseMetric|RatioMetric|DiffMetric;
type CategorySpec={title:string;description:string;metrics:MetricSpec[];kpis:string[];trend:string[][];breakdown:string[];share:string[];dimensions:RegExp[]};

const PER=/\bper\b|\bcp[acmlo]\b|cost per|rate|ratio|%|percent|avg|average|mean|margin %/;
const IDS=/\b(id|code|zip|postal|postcode|phone|sku|ean|upc|isbn)\b/;
const PERIOD=/^(year|month|month number|month no|week|day|quarter|qtr|period|fiscal year|fy)$/;

export const AUTO_CATEGORIES:Record<AutoCategory,CategorySpec>={
 FINANCE:{
  title:'Finance dashboard',description:'Revenue, costs, profit and margins.',
  metrics:[
   {kind:'base',key:'REVENUE',label:'Revenue',patterns:[/^(net )?(sales|revenue|revenues|turnover|income)$/,/\bnet (sales|revenue)\b/,/\b(total|sales) (sales|revenue|amount)\b/,/\brevenue\b/,/\bsales\b/],exclude:[/gross|cost|price|tax|discount|unit|qty|quantity|count|number|target|budget|forecast|plan|rep|person|channel|team|region|date|id\b/,PER],agg:'SUM',format:'CURRENCY',better:'UP'},
   {kind:'base',key:'GROSS_SALES',label:'Gross sales',patterns:[/gross (sales|revenue)/],exclude:[PER],agg:'SUM',format:'CURRENCY',better:'UP'},
   {kind:'base',key:'DISCOUNTS',label:'Discounts',patterns:[/discount/],exclude:[/band|type|code|name/,PER],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'COGS',label:'Cost of sales',patterns:[/\bcogs\b/,/cost of (goods|sales|revenue)/,/product cost|direct cost/,/^cost$|^costs$|total cost/],exclude:[PER,/price/],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'EXPENSES',label:'Operating expenses',patterns:[/expense/,/\bopex\b/,/operating cost|overhead/],exclude:[PER],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'PROFIT_COLUMN',label:'Profit',patterns:[/^(gross |net |operating )?profit$/,/\bprofit\b/,/net income|earnings/],exclude:[PER,/margin/],agg:'SUM',format:'CURRENCY',better:'UP'},
   {kind:'base',key:'TAX',label:'Tax',patterns:[/^tax$|\btax amount\b|\bvat\b|\bgst\b|sales tax/],exclude:[PER],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'UNITS',label:'Units sold',patterns:[/units sold|quantity sold|\bunits\b|\bquantity\b|\bqty\b/],exclude:[PER,/price|cost/],agg:'SUM',format:'NUMBER',better:'UP'},
   {kind:'diff',key:'PROFIT',label:'Profit',plus:'REVENUE',minus:['COGS','EXPENSES'],format:'CURRENCY',better:'UP',explain:'Revenue minus cost of sales and operating expenses'},
   {kind:'ratio',key:'MARGIN',label:'Profit margin',num:'PROFIT',den:'REVENUE',format:'PERCENT',better:'UP',explain:'Profit divided by revenue'},
   {kind:'ratio',key:'EXPENSE_RATIO',label:'Expense ratio',num:'EXPENSES',den:'REVENUE',format:'PERCENT',better:'DOWN',explain:'Operating expenses divided by revenue'},
   {kind:'ratio',key:'DISCOUNT_RATE',label:'Discount rate',num:'DISCOUNTS',den:'GROSS_SALES',format:'PERCENT',better:'DOWN',explain:'Discounts divided by gross sales'},
  ],
  kpis:['REVENUE','COGS','PROFIT','MARGIN','EXPENSES','EXPENSE_RATIO','DISCOUNTS','UNITS'],
  trend:[['REVENUE','PROFIT'],['REVENUE','COGS'],['REVENUE','EXPENSES'],['REVENUE'],['PROFIT']],
  breakdown:['PROFIT','REVENUE','EXPENSES'],share:['REVENUE','EXPENSES','COGS'],
  dimensions:[/segment|division|department|business unit|\bunit\b|cost cent/,/categor|account|ledger|\bgl\b/,/product|item|service|line/,/country|region|market|territory|state|city|location|branch|store/,/channel|customer type/],
 },
 MARKETING:{
  title:'Marketing dashboard',description:'Spend, reach, clicks, conversions and return on spend.',
  metrics:[
   {kind:'base',key:'SPEND',label:'Spend',patterns:[/\b(ad |media |marketing )?spend\b/,/amount spent|spent/,/\bcost\b|\bcosts\b|ad cost|media cost|budget used/,/\bbudget\b/],exclude:[PER,/cogs|cost of goods|shipping|product|remaining|planned/],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'IMPRESSIONS',label:'Impressions',patterns:[/impression/,/\breach\b|\bviews\b/],exclude:[PER,/unique|frequency/],agg:'SUM',format:'NUMBER',better:'UP'},
   {kind:'base',key:'CLICKS',label:'Clicks',patterns:[/click/,/link clicks|sessions|visits/],exclude:[PER,/through|ctr/],agg:'SUM',format:'NUMBER',better:'UP'},
   {kind:'base',key:'LEADS',label:'Leads',patterns:[/\blead/,/sign ?ups?|registrations|form fills|subscribers/],exclude:[PER,/time|score|source/],agg:'SUM',format:'NUMBER',better:'UP'},
   {kind:'base',key:'CONVERSIONS',label:'Conversions',patterns:[/conversion|converted/,/purchases|\borders\b|acquisitions|results|sales count|transactions/],exclude:[PER,/value|revenue|cost|amount/],agg:'SUM',format:'NUMBER',better:'UP'},
   {kind:'base',key:'REVENUE',label:'Revenue',patterns:[/revenue|conversion value|purchase value|sales value|\bincome\b/,/^sales$|^value$/],exclude:[PER,/cost|spend/],agg:'SUM',format:'CURRENCY',better:'UP'},
   {kind:'ratio',key:'CTR',label:'Click-through rate',num:'CLICKS',den:'IMPRESSIONS',format:'PERCENT',better:'UP',explain:'Clicks divided by impressions'},
   {kind:'ratio',key:'CPC',label:'Cost per click',num:'SPEND',den:'CLICKS',format:'CURRENCY',better:'DOWN',explain:'Spend divided by clicks'},
   {kind:'ratio',key:'CONVERSION_RATE',label:'Conversion rate',num:'CONVERSIONS',den:'CLICKS',format:'PERCENT',better:'UP',explain:'Conversions divided by clicks'},
   {kind:'ratio',key:'CPA',label:'Cost per conversion',num:'SPEND',den:'CONVERSIONS',format:'CURRENCY',better:'DOWN',explain:'Spend divided by conversions'},
   {kind:'ratio',key:'CPL',label:'Cost per lead',num:'SPEND',den:'LEADS',format:'CURRENCY',better:'DOWN',explain:'Spend divided by leads'},
   {kind:'ratio',key:'ROAS',label:'Return on ad spend',num:'REVENUE',den:'SPEND',format:'MULTIPLE',better:'UP',explain:'Revenue divided by spend'},
  ],
  kpis:['SPEND','REVENUE','ROAS','CONVERSIONS','CPA','CLICKS','CTR','IMPRESSIONS','CONVERSION_RATE','LEADS','CPL','CPC'],
  trend:[['SPEND','REVENUE'],['SPEND','CONVERSIONS'],['CLICKS','CONVERSIONS'],['SPEND','LEADS'],['SPEND'],['CLICKS']],
  breakdown:['SPEND','CLICKS','IMPRESSIONS'],share:['CONVERSIONS','REVENUE','LEADS','CLICKS'],
  dimensions:[/channel|platform|network|publisher|medium/,/source/,/campaign/,/ad ?set|ad ?group|audience|\bad name\b|creative/,/country|region|market|device/],
 },
 OPERATIONS:{
  title:'Operations dashboard',description:'Volume, speed, cost and quality of your operations.',
  metrics:[
   {kind:'base',key:'VOLUME',label:'Units handled',patterns:[/order quantit|units shipped|units produced|production volume|products sold|items shipped/,/\borders\b|shipments|deliveries|jobs|tickets|work orders/,/\bquantity\b|\bqty\b|\bunits\b|\bvolume\b/],exclude:[PER,/cost|price|time|stock|lead|inventory|revenue/],agg:'SUM',format:'NUMBER',better:'UP'},
   {kind:'base',key:'LEAD_TIME',label:'Avg lead time',patterns:[/lead ?time|lead days/],exclude:[/cost/],agg:'AVG',format:'DAYS',better:'DOWN'},
   {kind:'base',key:'DELIVERY_TIME',label:'Avg delivery time',patterns:[/shipping time|delivery time|transit time|days to (ship|deliver)|delivery days|shipping days/],exclude:[/cost/],agg:'AVG',format:'DAYS',better:'DOWN'},
   {kind:'base',key:'CYCLE_TIME',label:'Avg cycle time',patterns:[/cycle time|processing time|handling time|turnaround|resolution time|manufacturing lead time/],exclude:[/cost/],agg:'AVG',format:'DAYS',better:'DOWN'},
   {kind:'base',key:'SHIPPING_COST',label:'Shipping cost',patterns:[/shipping cost|freight|delivery cost|logistics cost|transport(ation)? cost/],exclude:[PER],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'PRODUCTION_COST',label:'Production cost',patterns:[/manufacturing cost|production cost|operating cost|labou?r cost|^costs?$/],exclude:[PER,/shipping/],agg:'SUM',format:'CURRENCY',better:'DOWN'},
   {kind:'base',key:'DEFECT_RATE_COLUMN',label:'Defect rate',patterns:[/defect rate|error rate|return rate|scrap rate|failure rate|rejection rate/],agg:'AVG',format:'PERCENT',better:'DOWN',rate:true},
   {kind:'base',key:'DEFECTS',label:'Defects',patterns:[/defects|errors|returns|rejects|rejected|failures/],exclude:[/rate|%|cost/],agg:'SUM',format:'NUMBER',better:'DOWN'},
   {kind:'base',key:'STOCK',label:'Avg stock level',patterns:[/stock level/,/\bstock\b|inventory|on hand/,/availability/],exclude:[/cost|value|turn/],agg:'AVG',format:'NUMBER',better:'UP'},
   {kind:'base',key:'REVENUE',label:'Revenue',patterns:[/revenue|\bsales\b/],exclude:[PER,/cost|count|number|quantity|units|products sold/],agg:'SUM',format:'CURRENCY',better:'UP'},
   {kind:'ratio',key:'DEFECT_RATE',label:'Defect rate',num:'DEFECTS',den:'VOLUME',format:'PERCENT',better:'DOWN',explain:'Defects divided by units handled'},
   {kind:'ratio',key:'SHIPPING_PER_UNIT',label:'Shipping cost per unit',num:'SHIPPING_COST',den:'VOLUME',format:'CURRENCY',better:'DOWN',explain:'Shipping cost divided by units handled'},
  ],
  kpis:['VOLUME','LEAD_TIME','DELIVERY_TIME','CYCLE_TIME','SHIPPING_COST','PRODUCTION_COST','DEFECT_RATE_COLUMN','DEFECT_RATE','STOCK','REVENUE','SHIPPING_PER_UNIT'],
  trend:[['VOLUME','SHIPPING_COST'],['VOLUME','DEFECTS'],['VOLUME'],['LEAD_TIME'],['SHIPPING_COST']],
  breakdown:['VOLUME','SHIPPING_COST','PRODUCTION_COST','LEAD_TIME'],share:['VOLUME','SHIPPING_COST','PRODUCTION_COST','REVENUE'],
  dimensions:[/supplier|vendor/,/carrier|shipping mode|transport|route|courier/,/warehouse|location|plant|site|facility|depot|store|city/,/product type|categor|product|line|machine|team|department/,/status|priority|region|country/],
 },
};

// ---------- Parsing ----------

const normal=(name:string)=>name.toLowerCase().replace(/[_\-./]+/g,' ').replace(/\s+/g,' ').trim();

/** Numbers from exports: "$ 1,234.50", "(1,200)", "$ -", "12%", "1.234,50" (when the file uses comma decimals). */
export function parseNumber(value:AutoCell,commaDecimal=false):number|null{
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value==='boolean'||value==null)return null;
 let text=String(value).trim();if(!text)return null;
 if(!/\d/.test(text))return /^[^A-Za-z]*[-–][^A-Za-z]*$/.test(text)?0:null; // "$ -" means zero in accounting exports
 let negative=false;
 if(/^\(.*\)$/.test(text)){negative=true;text=text.slice(1,-1).trim();}
 text=text.replace(/^(?:[A-Za-z]{1,3}\.?|[$€£¥₹₺])\s*/,'');           // leading currency: "$", "Rs.", "USD"
 if(/^\(.*\)$/.test(text)){negative=!negative;text=text.slice(1,-1).trim();}           // "$ (4,533.75)"
 if(text.startsWith('-')){negative=!negative;text=text.slice(1).trim();}
 text=text.replace(/^(?:[A-Za-z]{1,3}\.?|[$€£¥₹₺])\s*/,'');           // "-$5"
 text=text.replace(/\s*(?:%|[A-Za-z]{1,3}|[$€£¥₹₺])$/,'').replace(/\s/g,''); // trailing "%", "USD"
 text=commaDecimal?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
 if(!/^\d+(\.\d+)?$|^\.\d+$/.test(text))return null;
 const n=Number(text);return Number.isFinite(n)?(negative?-n:n):null;
}

const MONTHS:Record<string,number>={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
/** Returns a UTC day number (days since epoch) or null. */
export function parseDate(value:AutoCell,dayFirst:boolean):number|null{
 if(value==null||typeof value==='boolean')return null;
 const text=String(value).trim();let y:number,m:number,d:number,match;
 if((match=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text))){y=+match[1];m=+match[2];d=+match[3];}
 else if((match=/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/.exec(text))){y=+match[1];m=+match[2];d=+match[3];}
 else if((match=/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text))){const a=+match[1],b=+match[2];y=+match[3];if(y<100)y+=2000;[d,m]=dayFirst?[a,b]:[b,a];}
 else if((match=/^(\d{1,2})[ -]([A-Za-z]{3,9})[-, ]+(\d{4})/.exec(text))){d=+match[1];m=MONTHS[match[2].slice(0,4).toLowerCase()]??MONTHS[match[2].slice(0,3).toLowerCase()];y=+match[3];}
 else if((match=/^([A-Za-z]{3,9})[ -]+(\d{1,2}),?[ -]+(\d{4})/.exec(text))){m=MONTHS[match[1].slice(0,3).toLowerCase()];d=+match[2];y=+match[3];}
 else if((match=/^([A-Za-z]{3,9})[-, ]+(\d{4})$/.exec(text))){m=MONTHS[match[1].slice(0,3).toLowerCase()];d=1;y=+match[2];}
 else if((match=/^(\d{4})[-/](\d{1,2})$/.exec(text))){y=+match[1];m=+match[2];d=1;}
 else return null;
 if(!m||m<1||m>12||d<1||d>31||y<1900||y>2200)return null;
 const t=Date.UTC(y,m-1,d);const check=new Date(t);if(check.getUTCMonth()!==m-1)return null;
 return Math.floor(t/86400000);
}
export const dayToIso=(day:number)=>new Date(day*86400000).toISOString().slice(0,10);

// ---------- Column recognition ----------

export type ColumnProfile={name:string;key:string;numeric:boolean;date:boolean;text:boolean;distinct:number;examples:string[]};

export function profileColumns(columns:readonly AutoColumn[],rows:readonly AutoRow[]){
 const sample=rows.length>2000?rows.filter((_,i)=>i%Math.ceil(rows.length/2000)===0):rows;
 const values=(c:string)=>sample.map(r=>r[c]).filter(v=>v!=null&&String(v).trim()!=='');
 // Comma decimals only when clearly used ("1.234,56" / "12,5").
 let comma=0,dot=0;for(const c of columns)for(const v of values(c.name).slice(0,200)){const t=String(v);if(/\d\.\d{3},\d{1,2}\b|^\s*-?\d+,\d{1,2}\s*$/.test(t))comma++;else if(/\d,\d{3}\.\d{1,2}\b|^\s*-?\d+\.\d{1,2}\s*$/.test(t))dot++;}
 const commaDecimal=comma>dot;
 // Day/month order from unambiguous values.
 let dayFirst=0,monthFirst=0;for(const c of columns)for(const v of values(c.name).slice(0,500)){const m=/^\s*(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(String(v));if(!m)continue;if(+m[1]>12&&+m[2]<=12)dayFirst++;else if(+m[2]>12&&+m[1]<=12)monthFirst++;}
 const isDayFirst=dayFirst>monthFirst;
 const profiles:ColumnProfile[]=columns.map(c=>{
  const vs=values(c.name),key=normal(c.name);const n=Math.max(vs.length,1);
  const dateHits=vs.filter(v=>parseDate(v,isDayFirst)!=null).length;
  const date=c.dataType==='DATE'||(vs.length>0&&dateHits/n>=0.8&&!/^\d+(\.\d+)?$/.test(String(vs[0]).trim()));
  const numHits=vs.filter(v=>parseNumber(v,commaDecimal)!=null).length;
  const numeric=!date&&(c.dataType==='NUMBER'||(vs.length>0&&numHits/n>=0.8))&&!IDS.test(key)&&!PERIOD.test(key);
  const distinct=new Set(vs.map(v=>String(v).trim().toLowerCase())).size;
  return {name:c.name,key,numeric,date,text:!numeric&&!date,distinct,examples:[...new Set(vs.slice(0,50).map(v=>String(v).trim()))].slice(0,5)};
 });
 return {profiles,commaDecimal,dayFirst:isDayFirst};
}

export type Recognition={metrics:Record<string,string>;dateField:string|null;dimensions:string[]};

/** Match each base metric to the first unused numeric column whose name fits, trying patterns in priority order. */
export function recognise(category:AutoCategory,profiles:readonly ColumnProfile[],rowCount:number):Recognition{
 const spec=AUTO_CATEGORIES[category];const used=new Set<string>();const metrics:Record<string,string>={};
 for(const m of spec.metrics){if(m.kind!=='base')continue;
  outer:for(const pattern of m.patterns)for(const p of profiles){
   if(!p.numeric||used.has(p.name))continue;
   if(!pattern.test(p.key))continue;
   if(m.exclude?.some(x=>x.test(p.key)))continue;
   metrics[m.key]=p.name;used.add(p.name);break outer;
  }
 }
 const dates=profiles.filter(p=>p.date);
 const dateField=(dates.find(p=>/order|invoice|transaction|sale|date|day/.test(p.key))??dates[0])?.name??null;
 // Useful grouping columns: text with a manageable number of distinct values.
 const candidates=profiles.filter(p=>p.text&&p.distinct>=2&&p.distinct<=Math.max(60,Math.min(200,rowCount/3))&&!IDS.test(p.key)&&!PERIOD.test(p.key)&&!/name$|email|description|comment|note|address|url|month name|^month$|^day$/.test(p.key));
 const ranked=[...candidates].sort((a,b)=>{const rank=(p:ColumnProfile)=>{const i=spec.dimensions.findIndex(r=>r.test(p.key));return i<0?99:i;};return rank(a)-rank(b)||a.distinct-b.distinct;});
 return {metrics,dateField,dimensions:ranked.map(p=>p.name)};
}

// ---------- Calculation ----------

export type AutoQuery={start?:string|null;end?:string|null;filterField?:string|null;filterValue?:string|null;breakdown?:string|null};
export type AutoSettings={hidden?:string[];order?:string[];breakdown?:string|null;shareChart?:'DONUT'|'BAR';trend?:string[]|null};
export type AutoMetricResult={key:string;label:string;format:AutoFormat;better:'UP'|'DOWN';value:number;previous:number|null;change:number|null;source:string};
export type AutoResult={
 category:AutoCategory;title:string;description:string;currency:string;rowCount:number;filteredRows:number;
 dateField:string|null;dateRange:{start:string;end:string}|null;selectedRange:{start:string;end:string}|null;comparison:{start:string;end:string}|null;
 metrics:AutoMetricResult[];available:string[];missing:{key:string;label:string;needs:string}[];
 trend:{grain:'DAY'|'WEEK'|'MONTH';metrics:{key:string;label:string;format:AutoFormat}[];points:{period:string;label:string;values:(number|null)[]}[]}|null;
 breakdown:{field:string;metric:{key:string;label:string;format:AutoFormat};items:{label:string;value:number}[]}|null;
 share:{field:string;metric:{key:string;label:string;format:AutoFormat};items:{label:string;value:number}[]}|null;
 table:{field:string;columns:{key:string;label:string;format:AutoFormat}[];rows:{label:string;values:(number|null)[]}[]}|null;
 dimensions:{field:string;values:string[]}[];
 notes:string[];
};

type Accumulator={sum:Record<string,number>;count:Record<string,number>};
const newAcc=():Accumulator=>({sum:{},count:{}});

function accumulate(acc:Accumulator,row:AutoRow,recognition:Recognition,commaDecimal:boolean){
 for(const [key,field] of Object.entries(recognition.metrics)){const v=parseNumber(row[field],commaDecimal);if(v==null)continue;acc.sum[key]=(acc.sum[key]??0)+v;acc.count[key]=(acc.count[key]??0)+1;}
}

/** Final metric values from accumulated sums, including ratios and differences. */
export function finalise(category:AutoCategory,acc:Accumulator,recognition:Recognition,rateScale:Record<string,number>={}):Record<string,number|null>{
 const spec=AUTO_CATEGORIES[category];const out:Record<string,number|null>={};
 for(const m of spec.metrics){
  if(m.kind==='base'){if(!recognition.metrics[m.key]){out[m.key]=null;continue;}const n=acc.count[m.key]??0;out[m.key]=n?(m.agg==='AVG'?acc.sum[m.key]/n:acc.sum[m.key]):0;if(m.rate&&out[m.key]!=null)out[m.key]=out[m.key]!/(rateScale[m.key]??1);}
 }
 for(const m of spec.metrics){
  if(m.kind==='diff'){
   // A profit column in the file wins over a calculated one.
   if(out.PROFIT_COLUMN!=null&&m.key==='PROFIT'){out.PROFIT=out.PROFIT_COLUMN;continue;}
   const plus=out[m.plus],minus=m.minus.map(k=>out[k]).filter((v):v is number=>v!=null);
   out[m.key]=plus!=null&&minus.length?plus-minus.reduce((a,b)=>a+b,0):null;
  }
 }
 for(const m of spec.metrics){if(m.kind==='ratio'){const a=out[m.num],b=out[m.den];out[m.key]=a!=null&&b!=null&&b!==0?a/b:null;}}
 return out;
}

function metricSource(category:AutoCategory,key:string,recognition:Recognition,values:Record<string,number|null>):string{
 const spec=AUTO_CATEGORIES[category];const m=spec.metrics.find(x=>x.key===key)!;
 if(m.kind==='base')return `${m.agg==='AVG'?'Average':'Total'} of the "${recognition.metrics[key]}" column`;
 if(m.kind==='diff')return key==='PROFIT'&&values.PROFIT_COLUMN!=null?`Total of the "${recognition.metrics.PROFIT_COLUMN}" column`:m.explain;
 return m.explain;
}

const labelOf=(category:AutoCategory,key:string)=>{const m=AUTO_CATEGORIES[category].metrics.find(x=>x.key===key)!;return key==='PROFIT_COLUMN'?'Profit':m.label;};

export function computeAutoDashboard(input:{category:AutoCategory;columns:readonly AutoColumn[];rows:readonly AutoRow[];query?:AutoQuery;settings?:AutoSettings;currency?:string}):AutoResult{
 const {category,columns,rows}=input;const query=input.query??{},settings=input.settings??{};const spec=AUTO_CATEGORIES[category];
 const {profiles,commaDecimal,dayFirst}=profileColumns(columns,rows);
 const recognition=recognise(category,profiles,rows.length);
 const notes:string[]=[];
 const currency=input.currency??'USD';
 // Rates stored as 0-100 are converted to fractions.
 const rateScale:Record<string,number>={};
 for(const m of spec.metrics)if(m.kind==='base'&&m.rate&&recognition.metrics[m.key]){const vals=rows.map(r=>parseNumber(r[recognition.metrics[m.key]],commaDecimal)).filter((v):v is number=>v!=null);rateScale[m.key]=vals.some(v=>v>1.5)?100:1;}

 // Dates and the selected period.
 const dayOf=(row:AutoRow)=>recognition.dateField?parseDate(row[recognition.dateField],dayFirst):null;
 let minDay=Infinity,maxDay=-Infinity;if(recognition.dateField)for(const r of rows){const d=dayOf(r);if(d!=null){if(d<minDay)minDay=d;if(d>maxDay)maxDay=d;}}
 const hasDates=Number.isFinite(minDay);
 const startDay=query.start?parseDate(query.start,false):null,endDay=query.end?parseDate(query.end,false):null;
 const ranged=hasDates&&(startDay!=null||endDay!=null);
 const from=ranged?(startDay??minDay):-Infinity,to=ranged?(endDay??maxDay):Infinity;
 const span=ranged&&Number.isFinite(from)&&Number.isFinite(to)?to-from+1:0;
 const prevFrom=span?from-span:null,prevTo=span?from-1:null;

 // Orders or transactions that did not complete (refunded, cancelled, pending...) are left out of totals.
 const statusField=profiles.find(p=>p.text&&/status|state|stage/.test(p.key)&&!/marital|state name|^state$|province/.test(p.key))?.name??null;
 const NOT_COMPLETED=/^(refunded|cancell?ed|voided?|failed|declined|pending|draft|expired|abandoned|authori[sz]ed|unpaid|returned)$/;
 const statusValue=(row:AutoRow)=>statusField?String(row[statusField]??'').trim().toLowerCase().replace(/[\s-]+/g,'_'):'';
 let excluded=0;
 const completed=(row:AutoRow)=>{if(!statusField)return true;const ok=!NOT_COMPLETED.test(statusValue(row));if(!ok)excluded++;return ok;};
 const filterOk=(row:AutoRow)=>(!query.filterField||!query.filterValue||String(row[query.filterField]??'').trim()===query.filterValue)&&completed(row);
 const current=newAcc(),previous=newAcc();let filtered=0,previousRows=0;
 const inRange:AutoRow[]=[];
 for(const row of rows){
  if(!filterOk(row))continue;const d=dayOf(row);
  if(ranged){if(d==null)continue;if(d>=from&&d<=to){accumulate(current,row,recognition,commaDecimal);inRange.push(row);filtered++;}else if(prevFrom!=null&&d>=prevFrom&&d<=prevTo!){accumulate(previous,row,recognition,commaDecimal);previousRows++;}}
  else{accumulate(current,row,recognition,commaDecimal);inRange.push(row);filtered++;}
 }
 const now=finalise(category,current,recognition,rateScale),before=previousRows?finalise(category,previous,recognition,rateScale):null;

 // KPI cards in the customer's order, skipping duplicates such as a profit column and calculated profit.
 const available=spec.kpis.filter(k=>now[k]!=null&&!(k==='PROFIT_COLUMN'));
 const order=[...(settings.order??[]).filter(k=>available.includes(k)),...available.filter(k=>!(settings.order??[]).includes(k))];
 const metrics:AutoMetricResult[]=order.map(key=>{const m=spec.metrics.find(x=>x.key===key)!;const value=now[key]!,prev=before?.[key]??null;
  return {key,label:labelOf(category,key),format:m.format,better:m.better,value,previous:prev,change:prev!=null&&prev!==0?(value-prev)/Math.abs(prev):null,source:metricSource(category,key,recognition,now)};});
 const missing=spec.kpis.filter(k=>now[k]==null).map(k=>{const m=spec.metrics.find(x=>x.key===k)!;return {key:k,label:m.label,needs:m.kind==='base'?`a column like "${m.label}"`:m.kind==='ratio'?`${labelOf(category,m.num)} and ${labelOf(category,m.den)}`:`${labelOf(category,m.plus)} and costs`};});
 const fmtOf=(k:string)=>spec.metrics.find(x=>x.key===k)!.format;
 const pickTrend=(settings.trend?.filter(k=>now[k]!=null).length?[settings.trend.filter(k=>now[k]!=null).slice(0,2)]:[]).concat(spec.trend).find(set=>set.every(k=>now[k]!=null))??null;

 // Trend over time.
 let trend:AutoResult['trend']=null;
 if(hasDates&&pickTrend){
  const lo=ranged?from:minDay,hi=ranged?to:maxDay;const days=hi-lo+1;
  const grain:'DAY'|'WEEK'|'MONTH'=days<=62?'DAY':days<=210?'WEEK':'MONTH';
  const bucket=(d:number)=>{if(grain==='DAY')return dayToIso(d);if(grain==='WEEK'){const date=new Date(d*86400000);const dow=(date.getUTCDay()+6)%7;return dayToIso(d-dow);}return dayToIso(d).slice(0,7);};
  const buckets=new Map<string,Accumulator>();
  for(const row of inRange){const d=dayOf(row);if(d==null)continue;const b=bucket(d);if(!buckets.has(b))buckets.set(b,newAcc());accumulate(buckets.get(b)!,row,recognition,commaDecimal);}
  const keys=[...buckets.keys()].sort();
  const label=(k:string)=>grain==='MONTH'?new Date(k+'-01T00:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}):new Date(k+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  if(keys.length>=2)trend={grain,metrics:pickTrend.map(k=>({key:k,label:labelOf(category,k),format:fmtOf(k)})),points:keys.map(k=>{const v=finalise(category,buckets.get(k)!,recognition,rateScale);return {period:k,label:(grain==='WEEK'?'Wk of ':'')+label(k),values:pickTrend.map(m=>v[m])};})};
 }
 if(!recognition.dateField)notes.push('No date column was found, so trends over time are not shown.');
 if(statusField&&excluded)notes.push(`${excluded.toLocaleString('en-US')} rows marked as refunded, cancelled, pending or similar in the "${statusField}" column are not counted.`);

 // Breakdown and share by a grouping column.
 const dims=recognition.dimensions;
 const breakdownField=[query.breakdown,settings.breakdown,...dims].find(f=>f&&dims.includes(f))??null;
 const shareField=dims.find(f=>f!==breakdownField)??breakdownField;
 const groupBy=(field:string)=>{const groups=new Map<string,Accumulator>();for(const row of inRange){const raw=row[field];const label=raw==null||String(raw).trim()===''?'(blank)':String(raw).trim();if(!groups.has(label))groups.set(label,newAcc());accumulate(groups.get(label)!,row,recognition,commaDecimal);}return [...groups].map(([label,acc])=>({label,values:finalise(category,acc,recognition,rateScale)}));};
 const top=(items:{label:string;value:number}[],limit:number)=>{const sorted=items.filter(i=>Number.isFinite(i.value)).sort((a,b)=>b.value-a.value);if(sorted.length<=limit)return sorted;const rest=sorted.slice(limit-1).reduce((a,b)=>a+b.value,0);return [...sorted.slice(0,limit-1),{label:'Other',value:rest}];};
 let breakdown:AutoResult['breakdown']=null,share:AutoResult['share']=null,table:AutoResult['table']=null;
 if(breakdownField){
  const groups=groupBy(breakdownField);const metricKey=spec.breakdown.find(k=>now[k]!=null);
  if(metricKey){const m=spec.metrics.find(x=>x.key===metricKey)!;const avg=m.kind==='base'&&m.agg==='AVG';
   breakdown={field:breakdownField,metric:{key:metricKey,label:labelOf(category,metricKey),format:m.format},items:avg?groups.map(g=>({label:g.label,value:g.values[metricKey]??NaN})).filter(i=>Number.isFinite(i.value)).sort((a,b)=>b.value-a.value).slice(0,10):top(groups.map(g=>({label:g.label,value:g.values[metricKey]??NaN})),10)};}
  const cols=metrics.slice(0,6).map(m=>({key:m.key,label:m.label,format:m.format}));
  table={field:breakdownField,columns:cols,rows:groups.sort((a,b)=>(b.values[cols[0]?.key]??-Infinity)-(a.values[cols[0]?.key]??-Infinity)).slice(0,15).map(g=>({label:g.label,values:cols.map(c=>g.values[c.key])}))};
 }
 if(shareField&&!(shareField===breakdownField&&breakdown&&spec.share.find(k=>now[k]!=null)===breakdown.metric.key)){
  const shareKey=spec.share.find(k=>now[k]!=null&&spec.metrics.find(x=>x.key===k)?.kind==='base'&&(spec.metrics.find(x=>x.key===k) as BaseMetric).agg==='SUM');
  if(shareKey){const groups=groupBy(shareField);share={field:shareField,metric:{key:shareKey,label:labelOf(category,shareKey),format:fmtOf(shareKey)},items:top(groups.map(g=>({label:g.label,value:Math.max(0,g.values[shareKey]??0)})),6).filter(i=>i.value>0)};}
 }

 // Filter options.
 const dimensionValues=dims.slice(0,4).map(field=>({field,values:[...new Set(rows.map(r=>r[field]).filter(v=>v!=null&&String(v).trim()!=='').map(v=>String(v).trim()))].sort().slice(0,200)}));
 if(!metrics.length)notes.push(`We could not find the columns this dashboard needs. Try a file with columns like ${spec.metrics.filter(m=>m.kind==='base').slice(0,4).map(m=>`"${m.label}"`).join(', ')}.`);
 return {category,title:spec.title,description:spec.description,currency,rowCount:rows.length,filteredRows:filtered,
  dateField:recognition.dateField,dateRange:hasDates?{start:dayToIso(minDay),end:dayToIso(maxDay)}:null,
  selectedRange:ranged&&Number.isFinite(from)&&Number.isFinite(to)?{start:dayToIso(from),end:dayToIso(to)}:null,
  comparison:previousRows&&prevFrom!=null?{start:dayToIso(prevFrom),end:dayToIso(prevTo!)}:null,
  metrics,available,missing,trend,breakdown,share,table,dimensions:dimensionValues,notes};
}

/** Detect currency from symbols in the recognised money columns. */
export function detectAutoCurrency(rows:readonly AutoRow[],fields:readonly string[],fallback='USD'){
 const text=rows.slice(0,300).flatMap(r=>fields.map(f=>String(r[f]??''))).join(' ')+' '+fields.join(' ');
 const symbols:[RegExp,string][]=[[/€|\bEUR\b/,'EUR'],[/£|\bGBP\b/,'GBP'],[/₹|\bINR\b/,'INR'],[/\bPKR\b|\bRs\.?\s?\d/i,'PKR'],[/₺|\bTRY\b/,'TRY'],[/\bAED\b/,'AED'],[/\bSAR\b/,'SAR'],[/¥|\bJPY\b/,'JPY'],[/\bCAD\b|C\$/,'CAD'],[/\bAUD\b|A\$/,'AUD'],[/\$|\bUSD\b/,'USD']];
 for(const [p,c] of symbols)if(p.test(text))return c;
 return fallback;
}
