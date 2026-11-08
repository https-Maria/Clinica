function node(tag,text,klass=''){
  const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;
  if(klass)el.className=klass;
  return el;
}
const nowLocal=()=>{
  const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
function toLocal(date){
  if(!date)return '';
  const d=new Date(date);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function button(label,handler,variant='secondary'){
  const b=node('button',label,'btn '+variant);b.type='button';b.addEventListener('click',handler);return b;
}
function formFor(db,old,onSave,notify){
  const overlay=node('div',undefined,'overlay');
  const card=node('section',undefined,'modal small-dialog');
  card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
  card.append(node('h2',old?'Editar lembrete':'Novo lembrete'));
  const form=node('form'),fields=node('div',undefined,'fields reminder-fields');
  const specs=[
    ['title','Título','text',true],
    ['body','Anotações','textarea',false],
    ['due_at','Lembrar em (opcional)','datetime-local',false],
    ['priority','Prioridade','priority',true]
  ];
  for(const [id,label,type,required] of specs){
    const wrap=node('div',undefined,type==='textarea'?'full':'');
    const l=node('label',label);const input=node(type==='textarea'?'textarea':type==='priority'?'select':'input',undefined,'input');
    input.name=id;input.id='r_'+id;l.htmlFor=input.id;
    if(type==='priority')for(const k of ['baixa','normal','alta'])input.append(new Option(k[0].toUpperCase()+k.slice(1),k));
    else if(type!=='textarea')input.type=type;
    if(required)input.required=true;
    if(id==='due_at')input.value=toLocal(old?.due_at);
    else input.value=old?.[id]??(id==='priority'?'normal':'');
    wrap.append(l,input);fields.append(wrap);
  }
  const actions=node('div',undefined,'actions modal-actions');
  const save=node('button','Salvar','btn');save.type='submit';
  actions.append(button('Cancelar',()=>overlay.remove()),save);
  form.append(fields,actions);card.append(form);overlay.append(card);document.body.append(overlay);
  overlay.addEventListener('click',ev=>{if(ev.target===overlay)overlay.remove();});
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();save.disabled=true;
    const payload={
      title:form.elements.title.value.trim(),
      body:form.elements.body.value.trim()||null,
      due_at:form.elements.due_at.value?new Date(form.elements.due_at.value).toISOString():null,
      priority:form.elements.priority.value
    };
    const query=old?db.from('personal_reminders').update(payload).eq('id',old.id):db.from('personal_reminders').insert(payload);
    const {error}=await query;save.disabled=false;
    if(error){notify('Não foi possível salvar lembrete: '+error.message,true);return;}
    overlay.remove();notify('Lembrete salvo.');await onSave();
  });
  card.querySelector('input')?.focus();
}
export async function renderReminders(db,target,notify){
  target.replaceChildren(node('p','Carregando seus lembtes…','muted'));
  const {data,error}=await db.from('personal_reminders').select('*')
    .eq('active',true).order('due_at',{ascending:true,nullsFirst:false}).limit(500);
  if(error){target.replaceChildren(node('p','Falha ao carregar lembretes: '+error.message,'notice bad'));return;}
  const card=node('section',undefined,'card');
  const header=node('div',undefined,'toolbar');
  const text=node('div');text.append(node('h2','Minhas notas e lembretes'),node('p','Privados: cada usuário só vê as próprias notas. O prazo é exibido no painel, sem notificação externa.','muted'));
  header.append(text,button('+ Novo lembrete',()=>formFor(db,null,()=>renderReminders(db,target,notify),notify),''));
  card.append(header);
  const rows=data||[];
  if(!rows.length)card.append(node('p','Você ainda não criou nenhum lembrete.','empty'));
  const now=new Date();
  for(const item of rows){
    const line=node('article',undefined,'reminder-card'+(item.completed_at?' completed':''));
    const top=node('div',undefined,'reminder-top');
    const title=node('strong',item.title);
    const pr=node('span',item.priority==='alta'?'Alta prioridade':item.priority==='baixa'?'Baixa prioridade':'Prioridade normal','pill '+(item.priority==='alta'?'priority-high':''));
    top.append(title,pr);
    const meta=node('div',undefined,'muted reminder-meta');
    if(item.due_at){
      const overdue=!item.completed_at&&new Date(item.due_at)<now;
      meta.append(node('span',(overdue?'Atrasado · ':'Prazo · ')+new Date(item.due_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}),overdue?'overdue':''));
    }else meta.append(node('span','Sem prazo definido'));
    if(item.completed_at)meta.append(node('span','Concluído'));
    line.append(top,meta);
    if(item.body)line.append(node('p',item.body,'reminder-body'));
    const actions=node('div',undefined,'actions');
    actions.append(button(item.completed_at?'Reabrir':'Concluir',async()=>{
      const {error:e}=await db.from('personal_reminders').update({completed_at:item.completed_at?null:new Date().toISOString()}).eq('id',item.id);
      if(e){notify('Falha ao atualizar: '+e.message,true);return;}
      await renderReminders(db,target,notify);
    },'secondary small'));
    actions.append(button('Editar',()=>formFor(db,item,()=>renderReminders(db,target,notify),notify),'secondary small'));
    actions.append(button('Arquivar',async()=>{
      if(!confirm('Arquivar esta nota?'))return;
      const {error:e}=await db.from('personal_reminders').update({active:false}).eq('id',item.id);
      if(e){notify('Falha ao arquivar: '+e.message,true);return;}
      await renderReminders(db,target,notify);
    },'secondary small'));
    line.append(actions);card.append(line);
  }
  target.replaceChildren(card);
}
