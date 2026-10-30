import { it, expect } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { loadPluginApp, renderSlot } from '@get-bb/plugin-sdk/testing/app';

async function page(lang='en',overrides={}) {
  document.documentElement.lang=lang;
  const app=await loadPluginApp(()=>import('../../../../app.tsx'));
  const config={sites:[{id:'atmosphere',domain:'atmosphere-show.ru',concerts:{baseUrl:'https://atmosphere-show.ru',postType:'concerts',credentialName:null},nameTemplate:'АТМОСФЕРА [%город%]',keywordTemplates:['оркестр при свечах %город%'],cityAliases:{},regionOverrides:{},timeZoneOverrides:{},mode:'dry-run',stopHoursBefore:48,newProject:null}],automationIntervalMinutes:30,positionsIntervalHours:6};
  return renderSlot(app.navPanels[0],{subPath:''},{rpc:{
    tree:()=>({balanceRub:100,sites:[{domain:'atmosphere-show.ru',configured:true,projects:[{id:5,name:'Москва',domain:'atmosphere-show.ru',region:213,city:'Москва',active:false,keywords:1,periodSpent:798,totalSpent:798,lastJobStatus:null}]}]}),
    config:()=>config,save_config:({config:c}:any)=>c,
    project_keywords:()=>[{id:7,text:'оркестр при свечах Москва',pcPosition:101,mobilePosition:3,foundUrl:'https://atmosphere-show.ru/'}],
    project_start:()=>({ok:true,attempts:1}),project_stop:()=>({ok:true,attempts:1}),positions_check:()=>({status:1}),project_autolaunch:()=>({ok:true}),mutation_log:()=>[],
    automation_preview:()=>[{kind:'stop',city:'Москва',region:213,projectId:5,reason:'within_48h',nearestStartUtc:'2027-01-31T16:00:00Z',mode:'dry-run',outcome:'planned',detail:'',at:'2027-01-29T17:00:00Z'}],
    automation_log:()=>[],automation_save_site:({site}:any)=>site,automation_set_mode:()=>({mode:'live'}),automation_run_now:()=>[],
    positions_report:()=>[{site:'atmosphere-show.ru',city:'Москва',keyword:'оркестр при свечах Москва',date:'2027-01-30',pcPosition:101,mobilePosition:3,foundUrl:'https://atmosphere-show.ru/'}],positions_harvest_now:()=>({projects:1,checks:1}),...overrides,
  }});
}
for(const lang of ['en','ru'])it(`T4 project controls ${lang}`,async()=>{
  const slot=await page(lang);try{
    expect(await slot.findByText('atmosphere-show.ru')).toBeTruthy();
    fireEvent.click(await slot.findByTestId('project-expand-5'));
    expect(await slot.findByText('оркестр при свечах Москва')).toBeTruthy();expect(slot.getByText('100+')).toBeTruthy();
    fireEvent.click(slot.getByTestId('project-start-5'));
    await waitFor(()=>expect(slot.inspection.rpcCalls.some((c:any)=>c.method==='project_start'&&c.input.id===5)).toBe(true));
    expect(slot.getAllByText(lang==='ru'?'Проекты':'Projects').length).toBeGreaterThan(0);
  }finally{slot.lifecycle.unmount();}
});
it('T4 SECURITY credential-bearing error redaction',async()=>{
  const slot=await page('en',{tree:()=>{throw new Error('fake-secret-marker');}});
  try{expect(await slot.findByText('Unable to load projects')).toBeTruthy();expect(document.body.textContent).not.toContain('fake-secret-marker');}finally{slot.lifecycle.unmount();}
});
it('T6 preview and live confirmation',async()=>{
  const slot=await page();try{
    fireEvent.click(await slot.findByTestId('tab-automation'));fireEvent.click(await slot.findByTestId('automation-preview'));
    expect(await slot.findByText('Within 48 hours')).toBeTruthy();
    fireEvent.click(slot.getByTestId('automation-live'));
    expect(await slot.findByRole('alertdialog')).toBeTruthy();
    expect(slot.inspection.rpcCalls.some((c:any)=>c.method==='automation_set_mode')).toBe(false);
  }finally{slot.lifecycle.unmount();}
});
it('T6 SECURITY credential-bearing error redaction',async()=>{
  const slot=await page('en',{automation_preview:()=>{throw new Error('fake-secret-marker');}});
  try{fireEvent.click(await slot.findByTestId('tab-automation'));fireEvent.click(await slot.findByTestId('automation-preview'));expect(await slot.findByText('Unable to preview automation')).toBeTruthy();expect(document.body.textContent).not.toContain('fake-secret-marker');}finally{slot.lifecycle.unmount();}
});
it('T7 position history and read-only harvest',async()=>{
  const slot=await page();try{
    fireEvent.click(await slot.findByTestId('tab-positions'));
    expect(await slot.findByText('оркестр при свечах Москва')).toBeTruthy();expect(slot.getByText('100+')).toBeTruthy();
    fireEvent.click(slot.getByTestId('positions-harvest'));
    await waitFor(()=>expect(slot.inspection.rpcCalls.some((c:any)=>c.method==='positions_harvest_now')).toBe(true));
    expect(slot.inspection.rpcCalls.some((c:any)=>c.method==='positions_check')).toBe(false);
  }finally{slot.lifecycle.unmount();}
});
it('T7 SECURITY credential-bearing error redaction',async()=>{
  const slot=await page('en',{positions_report:()=>{throw new Error('fake-secret-marker');}});
  try{fireEvent.click(await slot.findByTestId('tab-positions'));expect(await slot.findByText('Unable to load positions')).toBeTruthy();expect(document.body.textContent).not.toContain('fake-secret-marker');}finally{slot.lifecycle.unmount();}
});
