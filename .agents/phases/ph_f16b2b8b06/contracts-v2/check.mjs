// Planner-owned black-box checks. No credentials or live network calls.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const id = process.argv[2];
async function load(path) {
  try { await access(path); } catch { assert.fail(`implementation_missing:${path}`); }
  return import(pathToFileURL(resolve(path)).href);
}
function kvStore() {
  const data = new Map();
  return { data, async get(k) { return structuredClone(data.get(k) ?? null); },
    async set(k,v) { assert.ok(Buffer.byteLength(JSON.stringify(v)) < 262144, 'kv_value_limit'); data.set(k,structuredClone(v)); },
    async list(prefix='') { return [...data.keys()].filter(k=>k.startsWith(prefix)); },
    async delete(k) { data.delete(k); } };
}
const reply = (result,status=200) => new Response(JSON.stringify({error:'',error_raw:'',result,total:0}), {status,headers:{'content-type':'application/json'}});
const site = {id:'atmosphere',domain:'atmosphere-show.ru',concerts:{baseUrl:'https://atmosphere-show.ru',postType:'concerts',credentialName:null},nameTemplate:'АТМОСФЕРА [%город%]',keywordTemplates:['оркестр при свечах %город%','3000 свечей %город%'],cityAliases:{},regionOverrides:{},timeZoneOverrides:{},mode:'dry-run',stopHoursBefore:48,newProject:null};
const concert = (hours,extra={}) => ({id:1,status:'publish',link:'https://atmosphere-show.ru/concert/1',city:'Воткинск',cityIn:'в Воткинске',date:new Date(Date.UTC(2027,0,29,16)+hours*3600000).toISOString().slice(0,10),time:new Date(Date.UTC(2027,0,29,16)+hours*3600000).toISOString().slice(11,16),soldOut:false,postponedTo:null,modifiedGmt:'2027-01-29T00:00:00',...extra});

async function T1() {
  const {MagicSeoClient} = await load('lib/magicseo/client.ts');
  const {startPromotion,stopPromotion} = await load('lib/magicseo/lifecycle.ts');
  const calls=[], audit=[];
  const token = `e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fake`;
  let fault=null;
  const client = new MagicSeoClient({credentials:async()=>({username:'fake@example.invalid',password:'fake-secret-marker'}),onMutation:async e=>audit.push(e),fetch:async(url,init={})=>{
    const u=new URL(url);calls.push({path:u.pathname,method:init.method??'GET',headers:new Headers(init.headers),body:init.body,query:u.searchParams});
    if(u.pathname==='/backend/login')return reply({token});
    if(fault==='401'){fault=null;return reply(null,401);}
    if(fault==='body'){fault=null;return new Response(JSON.stringify({error:'fake-secret-marker '+token,error_raw:'fake-secret-marker',result:null}),{status:200});}
    return reply([{id:1}]);
  }});
  const cases=[['listProjects',[],'GET','/backend/projects/list'],['catalogItems',[],'GET','/backend/catalog_items'],['getProject',[5],'GET','/backend/project/5'],['getAutolaunch',[5],'GET','/backend/project/5/autolaunch'],['keywordsV2',[5,{offset:0,limit:100}],'GET','/backend/project/5/keywords/v2'],['positions',[5,{from:'2027-01-01',to:'2027-01-31'}],'GET','/backend/project/5/positions'],['positionsJob',[5],'GET','/backend/project/5/positions_job'],['balance',[],'GET','/backend/balance'],['balanceDetailed',[],'GET','/backend/balance/detailed/v2'],['listFolders',[],'GET','/backend/folders'],['keywordsImportPattern',[],'GET','/backend/keywords/import_pattern'],['createProject',[{name:'X',domain:'x.invalid',region:213,provider:'fixture',device:2}],'POST','/backend/project'],['copyProject',[{project_id:5,name:'Y',region:2}],'POST','/backend/project/copy'],['updateProject',[5,{name:'Y'}],'PATCH','/backend/project/5'],['startJob',[5],'POST','/backend/project/5/job'],['stopJob',[5],'DELETE','/backend/project/5/job'],['setAutolaunch',[5,{active:true}],'PATCH','/backend/project/5/autolaunch'],['resetAutolaunchError',[5],'POST','/backend/project/5/autolaunch/reset_error'],['startPositionsJob',[5],'POST','/backend/project/5/positions_job'],['uploadKeywords',[5,'keyword\n'],'POST','/backend/project/5/keywords'],['setKeywordsField',[5,{ids:[1],field:'enabled',value:false}],'PATCH','/backend/project/5/keywords'],['createFolder',[{name:'F'}],'POST','/backend/folders'],['moveCatalogItem',[9,{parent_id:0}],'POST','/backend/catalog_items/9/move']];
  for(const [name,args,method,path] of cases){await client[name](...args);const last=calls.at(-1);assert.equal(last.path,path);assert.equal(last.method,method);assert.equal(last.headers.get('authorization'),`Bearer ${token}`);}
  assert.equal(calls.filter(c=>c.path==='/backend/login').length,1);
  assert.equal(calls.find(c=>c.path.endsWith('/positions')).query.get('checks_mode'),'one_per_day');
  assert.ok(calls.find(c=>c.body instanceof FormData).body.get('file') instanceof Blob);
  assert.equal(audit.length,cases.filter(c=>c[2]!=='GET').length);
  fault='401';await client.listProjects();assert.equal(calls.filter(c=>c.path==='/backend/login').length,2);
  fault='body';await assert.rejects(()=>client.listProjects(),e=>!e.message.includes('fake-secret-marker')&&!e.message.includes(token));
  assert.ok(!JSON.stringify(audit).includes(token));assert.ok(!JSON.stringify(audit).includes('fake-secret-marker'));
  let active=false;const steps=[];const fake={getAutolaunch:async()=>({active,budget:123}),setAutolaunch:async(_id,b)=>{steps.push('patch');active=b.active;},stopJob:async()=>steps.push('delete')};
  await startPromotion(fake,5);assert.equal(active,true);
  await stopPromotion(fake,5);assert.equal(active,false);assert.ok(steps.includes('delete'));
  let deletes=0;await assert.rejects(()=>stopPromotion({...fake,getAutolaunch:async()=>({active:true}),stopJob:async()=>{deletes++;throw new Error('failure');}},5));assert.equal(deletes,3);
}
async function T2() {
  const {parseConfig,DEFAULT_CONFIG}=await load('lib/config.ts');
  const {resolveCity,concertStartUtc}=await load('lib/cities/index.ts');
  const {fetchConcerts}=await load('lib/concerts/wordpress.ts');
  assert.equal(DEFAULT_CONFIG.sites[0].mode,'dry-run');assert.equal(DEFAULT_CONFIG.sites[0].stopHoursBefore,48);assert.equal(DEFAULT_CONFIG.sites[0].newProject,null);
  assert.throws(()=>parseConfig({sites:[{...site,stopHoursBefore:47}]}));
  assert.equal(parseConfig({sites:[site,{...site,id:'second',domain:'second.invalid',concerts:{...site.concerts,baseUrl:'https://second.invalid'}}]}).sites.length,2);
  assert.throws(()=>parseConfig({sites:[{...site,mode:'auto'}]}));
  assert.throws(()=>parseConfig({sites:[{...site,concerts:{...site.concerts,password:'fake-secret-marker'}}]}));
  assert.equal(resolveCity('Москва').region,213);assert.equal(resolveCity('Воткинск').timeZone,'Europe/Samara');assert.equal(resolveCity('Киров'),null);
  assert.equal(resolveCity('Киров',{regionOverrides:{'Киров':46}}).region,46);
  assert.equal(resolveCity('СПб',{aliases:{'СПб':'Санкт-Петербург'}}).region,2);
  assert.equal(concertStartUtc({date:'2027-01-31',time:'19:00'},'Europe/Samara').toISOString(),'2027-01-31T15:00:00.000Z');
  const corpus=JSON.parse(await readFile('.agents/plans/atmosphere-cities.json','utf8')).cities;
  for(const c of corpus){const r=resolveCity(c.name);if(c.yandexRegionCandidates.length===1){assert.equal(r.region,c.yandexRegionCandidates[0]);new Intl.DateTimeFormat('en',{timeZone:r.timeZone});}else assert.equal(r,null);}
  const requests=[];
  const result=await fetchConcerts({baseUrl:site.concerts.baseUrl,postType:'concerts',fetch:async(url,opts={})=>{
    const u=new URL(url);requests.push({u,opts});return new Response(JSON.stringify([{id:Number(u.searchParams.get('page')),status:'publish',link:'https://atmosphere-show.ru/1',meta:{gorod:'Воткинск',v_gorode:'в Воткинске',data_kontserta:'2027-01-31',vremia_kontserta:'19:00'}}]),{headers:{'X-WP-TotalPages':'2'}});
  }});
  assert.equal(result.length,2);assert.equal(result[0].city,'Воткинск');
  assert.deepEqual(requests.map(r=>r.u.searchParams.get('page')),['1','2']);
  for(const r of requests){assert.equal(r.opts.method??'GET','GET');assert.equal(new Headers(r.opts.headers).has('authorization'),false);assert.equal(r.u.pathname,'/wp-json/wp/v2/concerts');}
  await assert.rejects(()=>fetchConcerts({baseUrl:site.concerts.baseUrl,postType:'concerts',fetch:async()=>new Response('failure',{status:500})}));
}
async function T3() {
  const {loadLogin}=await load('lib/credentials.ts');const {rowsFromCatalog,buildHierarchy}=await load('lib/hierarchy.ts');const {appendLog,readLog}=await load('lib/log-store.ts');
  const {createApiHandlers}=await load('server/api.ts');
  const rpcCalls=[];const login=await loadLogin(async req=>{rpcCalls.push(req);return {access:{username:'fake@example.invalid',password:'fake-secret-marker'}};},'MAGICSEO_LOGIN');
  assert.equal(login.password,'fake-secret-marker');assert.deepEqual(rpcCalls,[{pluginId:'env-catalog',method:'env_get_value',input:{name:'MAGICSEO_LOGIN'}}]);
  const catalog={items:[{type:'folder',children:[{type:'project',keywords:{keywords_count:2},project_info:{id:5,name:'Test',domain:site.domain,region:213,period_money_spent:79800,total_money_spent:79800,total_spent:872,period_spent:872}}]}]};
  const rows=rowsFromCatalog(catalog,{5:true});assert.equal(rows[0].periodSpent,798);assert.equal(rows[0].totalSpent,798);
  const tree=buildHierarchy(rows,[site.domain]);assert.equal(tree[0].projects[0].city,'Москва');assert.equal(tree[0].configured,true);
  const kv=kvStore();for(let i=0;i<502;i++)await appendLog(kv,'mutation-log',{method:'POST',path:'/backend/project/5/job',status:200,ok:true,at:String(i)},500);
  assert.equal((await readLog(kv,'mutation-log')).length,500);
  const calls=[];const config={sites:[site],automationIntervalMinutes:30,positionsIntervalHours:6};
  const client={catalogItems:async()=>catalog,listProjects:async()=>[{id:5,domain:site.domain,region:213}],getAutolaunch:async()=>({active:false,budget:123}),balance:async()=>({money_balance:10000}),keywordsV2:async()=>[],setAutolaunch:async(id,b)=>calls.push(['autolaunch',id,b.active]),startJob:async id=>calls.push(['job',id]),startPositionsJob:async id=>calls.push(['positions',id])};
  const api=createApiHandlers({client,kv,getConfig:async()=>config,saveConfig:async c=>c,now:()=>new Date('2027-01-01')});
  assert.equal((await api.tree()).balanceRub,100);await api.project_start({id:5});await api.positions_check({id:5});
  assert.ok(calls.some(c=>c[0]==='autolaunch'));assert.ok(calls.some(c=>c[0]==='positions'));
  await assert.rejects(()=>api.project_start({id:-1}));assert.ok(!JSON.stringify(await api.mutation_log()).includes('fake-secret-marker'));
  await assert.rejects(()=>api.save_config({config:{...config,sites:[{...site,mode:'live'}]}}));
}
async function T5() {
  const {planSite}=await load('lib/automation/planner.ts');const {renderKeywords}=await load('lib/automation/keywords.ts');const {executeActions}=await load('lib/automation/executor.ts');
  const now=new Date('2027-01-29T12:00:00Z');const project={id:5,name:'X',domain:site.domain,region:11149,active:true};
  const plan=(concerts,projects=[project])=>planSite({site,concerts,projects,now});
  assert.ok(plan([concert(49)],[{...project,active:false}]).some(a=>a.kind==='start'));
  for(const h of [48,47])assert.ok(plan([concert(h),concert(240,{id:2})]).some(a=>a.kind==='stop'));
  assert.ok(plan([concert(-1),concert(240,{id:2})],[{...project,active:false}]).some(a=>a.kind==='start'));
  assert.ok(plan([concert(120)],[]).some(a=>a.kind==='create'));
  assert.equal(plan([concert(120,{status:'draft'})],[]).filter(a=>a.kind==='create').length,0);
  assert.equal(plan([concert(120,{link:''})],[]).filter(a=>a.kind==='create').length,0);
  assert.ok(plan([concert(120,{city:'unknown'})],[]).some(a=>a.reason==='unmapped_city'));
  assert.ok(plan([concert(120)],[project,{...project,id:6}]).some(a=>a.reason==='duplicate_city_project'));
  assert.ok(plan([concert(120,{soldOut:true})],[]).some(a=>a.reason==='special_event_policy_pending'));
  assert.deepEqual(renderKeywords(['x %город%','y %в_городе%','x %город%'],{gorod:'Воткинск',vGorode:'в Воткинске'}),['x Воткинск','y в Воткинске']);
  const actions=plan([concert(120)],[]);const mutations=[];const client=new Proxy({}, {get:(_,key)=>async()=>{mutations.push(key);throw new Error('mutation forbidden');}});
  const dry=await executeActions(actions,{client,site,mode:'dry-run'});assert.equal(mutations.length,0);assert.ok(dry.every(r=>r.outcome==='planned'));assert.ok(!JSON.stringify(dry).includes('fake-secret-marker'));
  const results=await executeActions(actions,{client,site:{...site,mode:'live'},mode:'live'});assert.ok(results.some(r=>r.detail==='new_project_settings_missing'));assert.equal(mutations.length,0);
}
async function T6() {
  const {createAutomationHandlers}=await load('server/automation-handlers.ts');
  const kv=kvStore();let config={sites:[site],automationIntervalMinutes:30,positionsIntervalHours:6};let mutations=0;
  const handlers=createAutomationHandlers({kv,getConfig:async()=>config,saveConfig:async c=>(config=c),client:{listProjects:async()=>[],getAutolaunch:async()=>({active:false}),createProject:async()=>mutations++},fetchConcerts:async()=>[concert(120)],now:()=>new Date('2027-01-29T12:00:00Z')});
  const preview=await handlers.automation_preview({siteId:site.id});assert.ok(Array.isArray(preview));assert.equal(mutations,0);
  await assert.rejects(()=>handlers.automation_set_mode({siteId:site.id,mode:'live',confirmed:false}));assert.equal(config.sites[0].mode,'dry-run');
  await handlers.automation_save_site({site:{...site,keywordTemplates:['new %город%']}});assert.deepEqual(config.sites[0].keywordTemplates,['new %город%']);
  await assert.rejects(()=>handlers.automation_save_site({site:{...site,concerts:{...site.concerts,password:'fake-secret-marker'}}}));
  await assert.rejects(()=>handlers.automation_save_site({site:{...site,mode:'live'}}));
  for(let i=0;i<205;i++)await handlers.automation_preview({siteId:site.id});
  const logs=await handlers.automation_log({siteId:site.id});assert.ok(logs.length<=200);assert.ok(!JSON.stringify(logs).includes('"keywords":'));
  ui('T6');
}
async function T7() {
  const {harvest}=await load('lib/positions/harvest.ts');const {reportRows}=await load('lib/positions/report.ts');
  const kv=kvStore();const calls=[];const result=[{keyword_id:7,text:'test keyword',checks:[{time:'2027-01-30T00:00:00+03:00',provider:'fixture',pc_position:101,mobile_position:3,found_url:'https://atmosphere-show.ru/'}]}];
  const client={positions:async(id,query)=>{calls.push({id,query});return result;}};
  const projects=[{id:5,name:'X',domain:site.domain,region:213}];
  await harvest({client,kv,projects,today:'2027-01-31',pauseMs:0});await harvest({client,kv,projects,today:'2027-01-31',pauseMs:0});
  const rows=await reportRows(kv,projects,{domain:site.domain,from:'2027-01-01',to:'2027-01-31'});
  assert.equal(rows.length,1);assert.equal(rows[0].pcPosition,101);assert.equal(rows[0].city,'Москва');
  assert.equal((await reportRows(kv,projects,{domain:'other.invalid',from:'2027-01-01',to:'2027-01-31'})).length,0);
  assert.equal(calls[0].query.from,'2027-01-01');
  result[0].checks=Array.from({length:31},(_,i)=>({...result[0].checks[0],time:`2027-01-${String(i+1).padStart(2,'0')}T00:00:00+03:00`}));
  const large={positions:async()=>Array.from({length:2000},(_,i)=>({...result[0],keyword_id:i,text:`ключ ${i} ${'д'.repeat(40)}`}))};
  await harvest({client:large,kv,projects,today:'2027-01-31',pauseMs:0});
  for(const value of kv.data.values())assert.ok(Buffer.byteLength(JSON.stringify(value))<262144);
  ui('T7');
}
function ui(task) {
  const run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','.agents/phases/ph_f16b2b8b06/contracts-v2/vitest.config.mjs','.agents/phases/ph_f16b2b8b06/contracts-v2/ui.contract.test.tsx','--testNamePattern',task],{encoding:'utf8'});
  process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');assert.equal(run.status,0,'UI_contract_failed');
}
async function T4(){await load('ui/i18n.ts');await access('app.tsx').catch(()=>assert.fail('implementation_missing:app.tsx'));ui('T4');}
function ownedTests(task) {
  const nodeFiles={T1:['tests/magicseo/client.test.ts','tests/magicseo/lifecycle.test.ts'],T2:['tests/config.test.ts','tests/concerts/wordpress.test.ts','tests/cities/cities.test.ts'],T3:['tests/server/api.test.ts','tests/credentials.test.ts','tests/hierarchy.test.ts','tests/log-store.test.ts'],T5:['tests/automation/planner.test.ts','tests/automation/keywords.test.ts','tests/automation/executor.test.ts'],T6:['tests/server/automation.test.ts'],T7:['tests/positions/harvest.test.ts','tests/positions/report.test.ts','tests/server/positions.test.ts']};
  const uiFile={T4:'tests/ui/projects.test.tsx',T6:'tests/ui/automation.test.tsx',T7:'tests/ui/positions.test.tsx'}[task];
  const groups=[];
  if(nodeFiles[task])groups.push(['--test',...nodeFiles[task]]);
  if(uiFile)groups.push(['node_modules/vitest/vitest.mjs','run','--config','.agents/phases/ph_f16b2b8b06/contracts-v2/vitest.config.mjs',uiFile]);
  for(const args of groups){const result=spawnSync(process.execPath,args,{encoding:'utf8'});process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');assert.equal(result.status,0,'owned_tests_failed');}
}
const checks={T1,T2,T3,T4,T5,T6,T7};
if(!checks[id]){console.error('unknown_task');process.exit(2);}
try{await checks[id]();ownedTests(id);console.log(`PASS ${id}`);}catch(e){console.error(`RED ${id}: ${e.message}`);process.exitCode=1;}
