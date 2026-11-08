import { createClient } from '@supabase/supabase-js';
import './style.css';
import { renderModule, moduleItems } from './modules.js';

const app = document.querySelector('#app');
const apiUrl = import.meta.env.VITE_SUPABASE_URL;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = apiUrl && apiKey && !apiKey.includes('COLOQUE_') ? createClient(apiUrl, apiKey) : null;
const state = { user: null, authorized: false, role: 'staff', page: 'inicio', patients: [], professionals: [] };
const schemas = {
  patients: [
    ['name','Nome completo','text',true],['birth_date','Nascimento','date'],
    ['phone','Telefone','tel'],['guardian_name','Responsável','text'],
    ['guardian_phone','Telefone do responsável','tel'],['email','E-mail','email'],
    ['address','Endereço','text'],['start_date','Data de início','date'],
    ['end_date','Data de encerramento','date'],['notes','Observações administrativas','textarea']
  ],
  professionals: [
    ['name','Nome completo','text',true],['phone','Telefone','tel'],
    ['email','E-mail','email'],['council_type','Conselho (CRM, CREFITO, etc.)','text'],
    ['council_number','Número do conselho','text'],['council_state','UF','text'],
    ['specialty','Especialidade','text'],['pix_key','Chave PIX','text'],
    ['default_share_pct','Percentual de repasse (%)','number',true],
    ['notes','Observações administrativas','textarea']
  ]
};
function element(tag, attrs={}, content) {
  const node=document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if(key==='class') node.className=value;
    else node.setAttribute(key,String(value));
  }
  if(content!==undefined) node.textContent=String(content);
  return node;
}
function btn(text,fn,kind='') {
  const b=element('button',{type:'button',class:'btn '+kind},text);
  b.addEventListener('click',fn);
  return b;
}
function message(text,error=false) {
  const target=document.querySelector('#message');
  if(target) {
    target.textContent=text;
    target.className=error?'notice bad':'notice';
  }
}
function wipe(node) {node.replaceChildren();}
function loginScreen() {
  wipe(app);
  const card=element('section',{class:'auth card'});
  const form=element('form');
  const email=element('input',{class:'input',type:'email',required:'',autocomplete:'username'});
  const password=element('input',{class:'input',type:'password',required:'',autocomplete:'current-password'});
  const submit=element('button',{class:'btn',type:'submit'},'Entrar');
  form.append(element('label',{},'E-mail'),email,element('label',{},'Senha'),password,submit,element('div',{id:'message'}));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    submit.disabled=true;
    const {error}=await supabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});
    submit.disabled=false;
    if(error) message('Não foi possível entrar. Verifique o e-mail e a senha.',true);
  });
  card.append(element('h1',{},'Clínica AnaCris'),element('p',{class:'muted'},'Acesso administrativo'),form);
  app.append(card);
}
function noAccess() {
  wipe(app);
  const card=element('section',{class:'auth card'});
  card.append(element('h1',{},'Acesso não autorizado'),
    element('p',{},'Esta conta ainda não foi autorizada pela administração da clínica.'),
    btn('Sair',()=>supabase.auth.signOut()));
  app.append(card);
}
function shell() {
  wipe(app);
  const wrapper=element('div',{class:'shell'});
  const sidebar=element('aside',{class:'sidebar'});
  const heading=element('div',{class:'brand'});
  heading.append(element('strong',{},'Clínica AnaCris'),element('small',{},'Gestão administrativa'));
  const menu=element('nav',{class:'menu'});
  for(const [key,label] of [['inicio','Início'],['patients','Pacientes'],['professionals','Profissionais'],...moduleItems]) {
    menu.append(btn(label,()=>{state.page=key;render();},'navbtn'));
  }
  sidebar.append(heading,menu);
  const main=element('main',{class:'main'});
  const top=element('header',{class:'top'});
  top.append(element('h1',{id:'title'}),btn('Sair',()=>supabase.auth.signOut(),'secondary'));
  main.append(top,element('div',{id:'message'}),element('div',{id:'view'}));
  wrapper.append(sidebar,main);
  app.append(wrapper);
}
async function refresh() {
  const [a,b]=await Promise.all([
    supabase.from('patients').select('*').order('name'),
    supabase.from('professionals').select('*').order('name')
  ]);
  if(a.error||b.error) {
    message('Erro ao consultar o banco. Verifique sua permissão ou conexão.',true);
    return;
  }
  state.patients=a.data||[];
  state.professionals=b.data||[];
  render();
}
function render() {
  const view=document.querySelector('#view');
  if(!view)return;
  const items=[['inicio','Visão geral'],['patients','Pacientes'],['professionals','Profissionais'],...moduleItems];
  document.querySelector('#title').textContent=items.find(x=>x[0]===state.page)?.[1]||'Clínica AnaCris';
  document.querySelectorAll('.navbtn').forEach((b,index)=>{
    b.classList.toggle('selected',index===items.findIndex(x=>x[0]===state.page));
  });
  wipe(view);
  if(state.page==='inicio') {
    const cards=element('div',{class:'cards'});
    for(const [label,num] of [
      ['Pacientes ativos',state.patients.filter(x=>x.active).length],
      ['Profissionais ativos',state.professionals.filter(x=>x.active).length],
      ['Total de cadastros',state.patients.length+state.professionals.length]
    ]) {
      const card=element('div',{class:'card stat'});
      card.append(element('span',{class:'muted'},label),element('strong',{},num));cards.append(card);
    }
    const note=element('div',{class:'card'});
    note.append(element('h2',{},'Bem-vinda à Clínica AnaCris'),
      element('p',{},'Use o menu para gerenciar pacientes, profissionais, serviços, contratos, atendimentos e financeiro. Os dados ficam no Supabase.'),
      element('p',{class:'muted'},'A sincronização automática com o Google Agenda ainda depende de configuração e autorização.'));
    view.append(cards,note);
  } else if(state.page==='patients'||state.page==='professionals') {
    renderTable(view);
  } else {
    void renderModule(supabase,state.page,view,message,state.role).catch(error=>{
      view.replaceChildren(element('p',{class:'notice bad'},'Não foi possível carregar o módulo.'));
      console.error('Erro no módulo',error);
    });
  }
}
function renderTable(view) {
  const isPatient=state.page==='patients';
  const data=state[state.page];
  const panel=element('section',{class:'card'});
  const bar=element('div',{class:'toolbar'});
  const search=element('input',{class:'input search',placeholder:'Buscar pelo nome…','aria-label':'Buscar pelo nome'});
  const actions=element('div',{class:'actions'});
  actions.append(btn('Exportar CSV',()=>exportCsv(data,isPatient),'secondary'),
    btn(isPatient?'+ Novo paciente':'+ Novo profissional',()=>openForm(null)));
  bar.append(search,actions);
  const wrap=element('div',{class:'table-wrap'});
  const table=element('table');
  const tr=element('tr');
  ['Nome',isPatient?'Telefone':'Conselho','Situação','Ações'].forEach(x=>tr.append(element('th',{},x)));
  const head=element('thead'); head.append(tr);
  const body=element('tbody'); table.append(head,body);wrap.append(table);panel.append(bar,wrap);view.append(panel);
  function draw() {
    wipe(body);
    const matches=data.filter(row=>row.name.toLocaleLowerCase('pt-BR').includes(search.value.trim().toLocaleLowerCase('pt-BR')));
    for(const row of matches) {
      const line=element('tr');
      const status=element('td');status.append(element('span',{class:row.active?'pill':'pill inactive'},row.active?'Ativo':'Inativo'));
      const controls=element('td',{class:'actions'});
      controls.append(btn('Editar',()=>openForm(row),'secondary small'),
        btn(row.active?'Inativar':'Reativar',()=>changeStatus(row),'secondary small'));
      line.append(element('td',{},row.name),
        element('td',{},isPatient?row.phone||'—':[row.council_type,row.council_number].filter(Boolean).join(' ')||'—'),
        status,controls);body.append(line);
    }
    if(!matches.length) {
      const empty=element('tr');empty.append(element('td',{colspan:'4',class:'empty'},'Nenhum cadastro encontrado.'));body.append(empty);
    }
  }
  search.addEventListener('input',draw);
  draw();
}
function openForm(existing) {
  const currentTable=state.page;
  const schema=schemas[currentTable];
  const overlay=element('div',{class:'overlay'});
  const modal=element('section',{class:'modal',role:'dialog','aria-modal':'true','aria-label':existing?'Editar cadastro':'Novo cadastro'});
  const form=element('form');const grid=element('div',{class:'fields'});
  modal.append(element('h2',{},existing?'Editar cadastro':'Novo cadastro'));
  for(const [name,label,type,required] of schema) {
    const block=element('div',{class:type==='textarea'?'full':''});
    const field=element(type==='textarea'?'textarea':'input',{id:'field_'+name,name,class:'input'});
    if(type!=='textarea')field.type=type;
    if(type==='number'){field.min='0';field.max='100';field.step='0.01';}
    if(required)field.required=true;
    field.value=existing?.[name]??(name==='default_share_pct'?'40':'');
    block.append(element('label',{for:'field_'+name},label),field);grid.append(block);
  }
  const actions=element('div',{class:'actions modal-actions'});
  const save=element('button',{class:'btn',type:'submit'},'Salvar');
  actions.append(btn('Cancelar',()=>overlay.remove(),'secondary'),save);
  form.append(grid,actions);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    save.disabled=true;
    const values={};
    for(const [name,,type,required] of schema) {
      const raw=form.elements.namedItem(name).value.trim();
      values[name]=raw===''&&!required?null:type==='number'?Number(raw):raw;
    }
    const action=existing?supabase.from(currentTable).update(values).eq('id',existing.id):supabase.from(currentTable).insert(values);
    const {error}=await action;
    save.disabled=false;
    if(error){window.alert('Não foi possível salvar. Confira os dados e tente novamente.');return;}
    overlay.remove();
    await refresh();message('Cadastro salvo com sucesso.');
  });
  modal.append(form);overlay.append(modal);
  overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
  document.body.append(overlay);modal.querySelector('input')?.focus();
}
async function changeStatus(row) {
  if(!window.confirm((row.active?'Inativar ':'Reativar ')+row.name+'? O registro não será apagado.'))return;
  const {error}=await supabase.from(state.page).update({active:!row.active}).eq('id',row.id);
  if(error){message('Falha ao alterar a situação.',true);return;}
  await refresh();message('Situação atualizada.');
}
function exportCsv(rows,isPatient) {
  const cols=isPatient?
    ['name','birth_date','phone','guardian_name','guardian_phone','email','address','start_date','end_date','notes','active']:
    ['name','phone','email','council_type','council_number','council_state','specialty','pix_key','default_share_pct','notes','active'];
  const csvCell=value=>{
    const text=String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""');
    return '"'+text+'"';
  };
  const csv='\uFEFF'+[cols.join(';'),...rows.map(row=>cols.map(key=>csvCell(row[key])).join(';'))].join('\r\n');
  const objectUrl=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=element('a',{href:objectUrl,download:(isPatient?'pacientes':'profissionais')+'_'+new Date().toISOString().slice(0,10)+'.csv'});
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),3000);
}
async function route() {
  if(!state.user){state.authorized=false;loginScreen();return;}
  const {data,error}=await supabase.from('clinic_members').select('user_id,active,role').eq('user_id',state.user.id).maybeSingle();
  state.authorized=!error&&data?.active===true;
  state.role=data?.role||'staff';
  if(!state.authorized){noAccess();return;}
  shell();await refresh();
}
async function init() {
  if(!supabase) {
    const card=element('section',{class:'auth card'});
    card.append(element('h1',{},'Configuração pendente'),
      element('p',{},'Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'));
    app.append(card);return;
  }
  const {data}=await supabase.auth.getUser();
  state.user=data?.user??null;
  supabase.auth.onAuthStateChange((_,session)=>{
    const newUser=session?.user??null;
    if(newUser?.id!==state.user?.id){state.user=newUser;setTimeout(()=>{void route();},0);}
  });
  await route();
}
void init();
