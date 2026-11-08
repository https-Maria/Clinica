import './modules.css';
import { divideRecebimento } from './finance.js';

const definitions = {
  services: { title: 'Serviços', singular: 'serviço', fields: [
    { k:'name', l:'Nome do serviço', required:true },
  ], cols: ['name'] },
  contracts: { title:'Contratos', singular:'contrato', fields: [
    {k:'patient_id',l:'Paciente',ref:'patients',required:true},
    {k:'professional_id',l:'Profissional',ref:'professionals',required:true},
    {k:'service_id',l:'Serviço',ref:'services'},
    {k:'billing_model',l:'Cobrança',choices:['mensalidade','por_sessao','pacote'],required:true},
    {k:'term',l:'Vigência',choices:['avulso','mensal','trimestral','semestral','personalizado'],required:true},
    {k:'amount',l:'Valor contratado (R$)',type:'number',step:'0.01',required:true},
    {k:'session_count',l:'Sessões contratadas',type:'number',step:'1'},
    {k:'share_pct',l:'Repasse especial (%)',type:'number',step:'0.01'},
    {k:'starts_on',l:'Data inicial',type:'date',required:true},
    {k:'ends_on',l:'Data final',type:'date'},
    {k:'due_day',l:'Dia do vencimento',type:'number',step:'1'},
    {k:'notes',l:'Observações',type:'textarea'}
  ], cols:['patient_id','professional_id','billing_model','amount','starts_on'] },
  appointments: { title:'Agenda / atendimentos', singular:'atendimento', fields: [
    {k:'patient_id',l:'Paciente',ref:'patients'},
    {k:'professional_id',l:'Profissional',ref:'professionals',required:true},
    {k:'service_id',l:'Serviço',ref:'services'},
    {k:'contract_id',l:'Contrato',ref:'contracts'},
    {k:'starts_at',l:'Início',type:'datetime-local',required:true},
    {k:'ends_at',l:'Término',type:'datetime-local'},
    {k:'status',l:'Situação',choices:['agendado','realizado','falta','cancelado'],required:true},
    {k:'notes',l:'Observações',type:'textarea'}
  ], cols:['starts_at','patient_id','professional_id','status'] },
  receivables: { title:'Contas a receber', singular:'cobrança', fields: [
    {k:'patient_id',l:'Paciente',ref:'patients',required:true},
    {k:'contract_id',l:'Contrato (opcional)',ref:'contracts'},
    {k:'description',l:'Descrição',required:true},
    {k:'amount',l:'Valor (R$)',type:'number',step:'0.01',required:true},
    {k:'due_on',l:'Vencimento',type:'date',required:true},
    {k:'notes',l:'Observações',type:'textarea'}
  ], cols:['patient_id','description','amount','due_on','payment_status'] },
  receipts: { title:'Recebimentos', singular:'recebimento', immutable:true, fields: [
    {k:'receivable_id',l:'Cobrança',ref:'receivables',required:true},
    {k:'amount',l:'Valor recebido (R$)',type:'number',step:'0.01',required:true},
    {k:'received_on',l:'Data do recebimento',type:'date',required:true},
    {k:'method',l:'Forma de pagamento',choices:['pix','dinheiro','transferencia','cartao','outro'],required:true},
    {k:'notes',l:'Observações',type:'textarea'}
  ], cols:['received_on','receivable_id','amount','method'] },
  expenses: { title:'Despesas', singular:'despesa', fields: [
    {k:'description',l:'Descrição',required:true},
    {k:'category',l:'Categoria'},
    {k:'amount',l:'Valor (R$)',type:'number',step:'0.01',required:true},
    {k:'due_on',l:'Vencimento',type:'date',required:true},
    {k:'paid_on',l:'Data do pagamento',type:'date'},
    {k:'recurrence',l:'Recorrência',choices:['unica','mensal','anual'],required:true},
    {k:'notes',l:'Observações',type:'textarea'}
  ], cols:['description','amount','due_on','paid_on'] },
  payouts: { title:'Repasses profissionais', singular:'repasse', fields: [
    {k:'professional_id',l:'Profissional',ref:'professionals',required:true},
    {k:'reference_on',l:'Data de referência',type:'date',required:true},
    {k:'amount',l:'Valor (R$)',type:'number',step:'0.01',required:true},
    {k:'status',l:'Situação',choices:['pendente','pago'],required:true},
    {k:'paid_on',l:'Data do pagamento',type:'date'},
    {k:'notes',l:'Observações',type:'textarea'}
  ], cols:['professional_id','reference_on','amount','status'] }
};
export const moduleItems = [
  ['services','Serviços'],['contracts','Contratos'],
  ['appointments','Agenda / sessões'],['receivables','A receber'],
  ['receipts','Recebimentos'],['expenses','Despesas'],
  ['payouts','Repasses'],['relatorios','Relatórios']
];
const tables = ['patients','professionals','services','contracts','appointments','receivables','receipts','expenses','payouts'];
function node(tag,klass='',value) {
  const e=document.createElement(tag);
  if(klass)e.className=klass;
  if(value!==undefined)e.textContent=String(value);
  return e;
}
function button(text,fn,cls='secondary') {
  const e=node('button','btn '+cls,text);e.type='button';e.addEventListener('click',fn);return e;
}
function fmtMoney(v) {return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function fmtDate(v) {
  if(!v)return '—';
  if(v.includes('T'))return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  const [y,m,d]=v.split('-');return [d,m,y].join('/');
}
function localFromIso(value) {
  if(!value)return '';
  const d=new Date(value);
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function csvExport(filename,fields,rows) {
  const safe=v=>{
    const text=String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""');
    return '"'+text+'"';
  };
  const content='\uFEFF'+[fields.join(';'),...rows.map(r=>fields.map(f=>safe(r[f])).join(';'))].join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const a=node('a');a.href=url;a.download=filename+'.csv';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function assoc(type,id,data) {
  if(!id)return '—';
  const hit=(data[type]||[]).find(x=>x.id===id);
  if(!hit)return 'Cadastro não encontrado';
  if(type==='contracts'){
    const person=assoc('patients',hit.patient_id,data);
    return person+' · '+fmtMoney(hit.amount);
  }
  if(type==='receivables')return hit.description+' · '+fmtMoney(hit.amount);
  return hit.name||hit.description||String(id);
}
function labelOf(field,value,data) {
  if(field==='payment_status')return statusReceivable(value,data);
  if(['amount','default_share_pct'].includes(field))return field==='amount'?fmtMoney(value):(value===null?'Padrão':String(value)+'%');
  if(['starts_on','ends_on','due_on','received_on','paid_on','reference_on','starts_at','ends_at'].includes(field))return fmtDate(value);
  const refs={patient_id:'patients',professional_id:'professionals',service_id:'services',contract_id:'contracts',receivable_id:'receivables'};
  if(refs[field])return assoc(refs[field],value,data);
  return value??'—';
}
function receivedFor(id,data){return data.receipts.filter(x=>x.receivable_id===id).reduce((total,x)=>total+Number(x.amount),0);}
function statusReceivable(row,data){
  if(!row.active)return 'Inativa';
  const paid=receivedFor(row.id,data),total=Number(row.amount);
  if(paid>=total-0.005)return 'Pago';
  const today=new Date();const day=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const basic=row.due_on<day?'Em atraso':'Pendente';
  return paid>0?'Parcial · '+basic:basic;
}
function createField(item,initial,data) {
  const wrap=node('div','form-group'+(item.type==='textarea'?' full':''));
  const label=node('label','',item.l+(item.required?' *':''));wrap.append(label);
  let input;
  if(item.type==='textarea')input=node('textarea','input');
  else if(item.ref || item.choices) {
    input=node('select','input');
    input.append(new Option(item.required?'Selecione...':'Nenhum',''));
    if(item.ref){
      let options=data[item.ref]||[];
      if(item.ref==='contracts')options=options.filter(x=>x.active);
      else if(item.ref==='receivables')options=options.filter(x=>x.active);
      else options=options.filter(x=>x.active);
      for(const entry of options) input.append(new Option(assoc(item.ref,entry.id,data),entry.id));
    } else for(const option of item.choices)input.append(new Option(option.replaceAll('_',' '),option));
  }else {input=node('input','input');input.type=item.type||'text';}
  input.name=item.k;
  if(item.required)input.required=true;
  if(item.step)input.step=item.step;
  if(item.type==='number'){input.min='0';if(item.k==='share_pct')input.max='100';}
  if(item.type==='datetime-local')input.value=localFromIso(initial?.[item.k]);
  else input.value=initial?.[item.k]??(item.k==='status'&&item.choices?.includes('pendente')?'pendente':({status:'agendado',method:'pix',billing_model:'mensalidade',term:'mensal',recurrence:'unica',reference_on:new Date().toISOString().slice(0,10),received_on:new Date().toISOString().slice(0,10)}[item.k]??''));
  label.htmlFor='field_'+item.k;input.id='field_'+item.k;
  wrap.append(input);return wrap;
}
function openForm(db,config,existing,data,reload,notify) {
  const overlay=node('div','overlay');
  const modal=node('section','modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.append(node('h2','',existing?'Editar '+config.singular:'Novo '+config.singular));
  const form=node('form');
  const grid=node('div','fields');
  config.fields.forEach(f=>grid.append(createField(f,existing,data)));
  const actions=node('div','actions modal-actions');
  const save=node('button','btn','Salvar');save.type='submit';
  actions.append(button('Cancelar',()=>overlay.remove()),save);
  form.append(grid,actions);
  form.addEventListener('submit',async e=>{
    e.preventDefault();save.disabled=true;
    const record={};
    for(const f of config.fields){
      const v=form.elements.namedItem(f.k).value.trim();
      record[f.k]=v===''?null:f.type==='number'?Number(v):f.type==='datetime-local'?new Date(v).toISOString():v;
    }
    if(config===definitions.payouts) {
      if(record.status==='pago'&&!record.paid_on){save.disabled=false;alert('Informe a data do pagamento do repasse.');return;}
      if(record.status==='pendente')record.paid_on=null;
    }
    if(config===definitions.receipts){
      const invoice=data.receivables.find(x=>x.id===record.receivable_id);
      const remaining=invoice?Number(invoice.amount)-receivedFor(invoice.id,data):0;
      if(Number(record.amount)>remaining+0.005){save.disabled=false;alert('O valor supera o saldo da cobrança.');return;}
    }
    const table=Object.keys(definitions).find(k=>definitions[k]===config);
    const query=existing?db.from(table).update(record).eq('id',existing.id):db.from(table).insert(record);
    const {error}=await query;save.disabled=false;
    if(error){alert('Erro ao salvar: '+error.message);return;}
    overlay.remove();notify('Registro salvo com sucesso.');await reload();
  });
  modal.append(form);overlay.append(modal);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  document.body.append(overlay);modal.querySelector('input,select')?.focus();
}
export async function renderModule(db,page,target,notify) {
  target.replaceChildren(node('p','muted','Carregando os dados…'));
  const results=await Promise.all(tables.map(table=>db.from(table).select('*').order('created_at',{ascending:false}).limit(1000)));
  if(results.some(r=>r.error)){
    target.replaceChildren(node('div','notice bad','Falha na consulta ao banco. Verifique a conexão e as permissões.'));
    return;
  }
  const data=Object.fromEntries(tables.map((table,i)=>[table,results[i].data||[]]));
  if(page==='relatorios') {renderReports(target,data);return;}
  const config=definitions[page];
  if(!config){target.textContent='Módulo não encontrado.';return;}
  const records=data[page]||[];
  const panel=node('section','card');
  const tools=node('div','toolbar');
  const search=node('input','input search');search.placeholder='Pesquisar…';search.setAttribute('aria-label','Pesquisar');
  const controls=node('div','actions');
  controls.append(button('Exportar CSV',()=>csvExport(page+'_'+new Date().toISOString().slice(0,10),config.fields.map(f=>f.k),records)));
  controls.append(button('+ Novo '+config.singular,()=>openForm(db,config,null,data,()=>renderModule(db,page,target,notify),notify),''));
  tools.append(search,controls);
  const caption=node('p','muted module-caption',
    page==='appointments'?'Agenda interna. Integração automática com Google Agenda ainda não conectada.':
    page==='payouts'?'Os repasses são registrados manualmente; sugestões de cálculo não significam dívida aprovada.':
    page==='receipts'?'Recebimentos são registros financeiros imutáveis. Correções exigem estorno controlado.':
    'Consulte, cadastre, edite e inative os registros quando aplicável.');
  const wrapper=node('div','table-wrap'),table=node('table'),thead=node('thead'),tbody=node('tbody'),thRow=node('tr');
  const headers=config.cols.map(c=>c==='payment_status'?'Situação':config.fields.find(f=>f.k===c)?.l||c);
  [...headers,'Ações'].forEach(h=>thRow.append(node('th','',h)));
  thead.append(thRow);table.append(thead,tbody);wrapper.append(table);
  panel.append(caption,tools,wrapper);target.replaceChildren(panel);
  function draw(){
    tbody.replaceChildren();
    const q=search.value.trim().toLocaleLowerCase('pt-BR');
    const shown=records.filter(row=>!q||JSON.stringify(row).toLocaleLowerCase('pt-BR').includes(q));
    shown.forEach(row=>{
      const tr=node('tr');
      config.cols.forEach(c=>{
        const td=node('td','',c==='payment_status'?statusReceivable(row,data):labelOf(c,row[c],data));
        tr.append(td);
      });
      const commands=node('td','actions');
      if(!config.immutable)commands.append(button('Editar',()=>openForm(db,config,row,data,()=>renderModule(db,page,target,notify),notify),'secondary small'));
      if(!config.immutable)commands.append(button(row.active?'Inativar':'Reativar',async()=>{
        if(!confirm((row.active?'Inativar':'Reativar')+' este registro?'))return;
        const {error}=await db.from(page).update({active:!row.active}).eq('id',row.id);
        if(error){notify('Não foi possível alterar: '+error.message,true);return;}
        notify('Situação atualizada.');await renderModule(db,page,target,notify);
      },'secondary small'));
      if(page==='receivables') commands.append(button('Receber',()=>openForm(db,definitions.receipts,null,{...data,receivables:data.receivables.filter(x=>x.id===row.id)},()=>renderModule(db,page,target,notify),notify),'secondary small'));
      tr.append(commands);tbody.append(tr);
    });
    if(!shown.length){const tr=node('tr');const td=node('td','empty','Nenhum registro encontrado');td.colSpan=config.cols.length+1;tr.append(td);tbody.append(tr);}
  }
  search.addEventListener('input',draw);draw();
}
function renderReports(target,data){
  const card=node('section','card reports');
  card.append(node('h2','','Relatórios de apoio'),node('p','muted','Dados do sistema até a data atual. Use CSV ou imprima em PDF pelo navegador.'));
  const now=new Date(), weekStart=new Date(now);
  weekStart.setHours(0,0,0,0);weekStart.setDate(now.getDate()-((now.getDay()+6)%7));
  const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+7);
  const weekly=data.appointments.filter(a=>a.active&&new Date(a.starts_at)>=weekStart&&new Date(a.starts_at)<weekEnd);
  const counts={realizado:0,falta:0,cancelado:0,agendado:0};
  weekly.forEach(x=>{if(x.status in counts)counts[x.status]++;});
  const monthlyDischarges=data.patients.filter(p=>p.end_date&&p.end_date.slice(0,7)===now.toISOString().slice(0,7));
  const weekRows=weekly.map(a=>({
    horario:fmtDate(a.starts_at),paciente:assoc('patients',a.patient_id,data),
    profissional:assoc('professionals',a.professional_id,data),
    situacao:a.status,observacoes:a.notes||''
  }));
  const estimateByProfessional=new Map();
  let unmatchedReceipts=0;
  for(const receipt of data.receipts){
    const invoice=data.receivables.find(c=>c.id===receipt.receivable_id);
    const contract=data.contracts.find(c=>c.id===invoice?.contract_id);
    const professional=data.professionals.find(p=>p.id===contract?.professional_id);
    if(!contract||!professional){unmatchedReceipts++;continue;}
    const pct=contract.share_pct??professional.default_share_pct??40;
    const amount=divideRecebimento(receipt.amount,pct).profissional;
    const old=estimateByProfessional.get(professional.id)||{profissional:professional.name,valor:0,recebimentos:0};
    old.valor+=amount;old.recebimentos++;
    estimateByProfessional.set(professional.id,old);
  }
  const estimateRows=[...estimateByProfessional.values()].map(x=>({
    profissional:x.profissional,recebimentos:x.recebimentos,
    estimativa:Math.round(x.valor*100)/100
  }));
  const estimatedTotal=estimateRows.reduce((s,x)=>s+x.estimativa,0);
  const activePatients=data.patients.filter(p=>p.active);
  const earned=data.receipts.reduce((s,x)=>s+Number(x.amount),0);
  const expenses=data.expenses.filter(x=>x.active&&x.paid_on).reduce((s,x)=>s+Number(x.amount),0);
  const paidPayout=data.payouts.filter(x=>x.active&&x.status==='pago').reduce((s,x)=>s+Number(x.amount),0);
  const mini=node('div','cards');
  for(const [label,value] of [
    ['Pacientes ativos',activePatients.length],['Altas neste mês',monthlyDischarges.length],
    ['Atendimentos na semana',counts.realizado],['Faltas na semana',counts.falta],
    ['Cancelamentos na semana',counts.cancelado],['Recebimentos registrados',fmtMoney(earned)],
    ['Despesas pagas registradas',fmtMoney(expenses)],['Repasses pagos registrados',fmtMoney(paidPayout)]
  ]){
    const s=node('div','card stat');s.append(node('span','muted',label),node('strong','',value));mini.append(s);
  }
  card.append(mini);
  const buttons=node('div','actions report-actions');
  buttons.append(button('Pacientes ativos · CSV',()=>csvExport('pacientes_ativos', ['name','phone','start_date','end_date'],activePatients)),
    button('Altas do mês · CSV',()=>csvExport('altas_mes',['name','end_date','phone'],monthlyDischarges)),
    button('Atendimentos da semana · CSV',()=>csvExport('atendimentos_semana',['horario','paciente','profissional','situacao','observacoes'],weekRows)),
    button('Estimativa de repasses · CSV',()=>csvExport('estimativa_repasses',['profissional','recebimentos','estimativa'],estimateRows)),
    button('Imprimir / Salvar PDF',()=>window.print()));
  card.append(buttons);
  const forecast=node('section','estimate-block');
  forecast.append(node('h3','','Estimativa de participação dos profissionais'),node('p','muted','Calculada apenas sobre recebimentos vinculados a contratos: regra do contrato, ou percentual do profissional, ou 40% padrão. Não é valor aprovado para pagamento.'));
  const estimateTable=node('table');
  const h=node('tr');['Profissional','Recebimentos','Estimativa'].forEach(x=>h.append(node('th','',x)));
  estimateTable.append(h);
  for(const row of estimateRows){
    const tr=node('tr');tr.append(node('td','',row.profissional),node('td','',row.recebimentos),node('td','',fmtMoney(row.estimativa)));estimateTable.append(tr);
  }
  forecast.append(estimateTable,node('p','', 'Total estimado: '+fmtMoney(estimatedTotal)+'. Recebimentos sem contrato/profissional associados: '+unmatchedReceipts+'.'));
  card.append(forecast);
  const note=node('p','muted','A estimativa não substitui a conferência da presença, do contrato e da condição de liberação do repasse. Relatórios financeiros acima exibem totais históricos, não saldos mensais.');
  card.append(note);target.replaceChildren(card);
}
