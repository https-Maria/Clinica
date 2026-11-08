const $=(tag,text,cls='')=>{
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=text;
  if(cls)n.className=cls;
  return n;
};
function createDialog(title,description) {
  const overlay=$('div',undefined,'overlay');
  const box=$('section',undefined,'modal small-dialog');
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label',title);
  box.append($('h2',title));
  if(description)box.append($('p',description,'muted'));
  overlay.append(box);document.body.append(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  return {overlay,box};
}
function makeButton(label,fn,kind='secondary small'){
  const b=$('button',label,'btn '+kind);b.type='button';b.addEventListener('click',fn);return b;
}
function field(label,type,required=false){
  const p=$('div',undefined,'form-group');
  const id='operation_'+Math.random().toString(36).slice(2);
  const l=$('label',label);l.htmlFor=id;
  const input=$('input',undefined,'input');
  input.id=id;input.type=type;input.required=required;
  p.append(l,input);
  return {wrap:p,input};
}
function actions(form,overlay){
  const footer=$('div',undefined,'actions modal-actions');
  const cancel=makeButton('Cancelar',()=>overlay.remove());
  const save=$('button','Confirmar','btn');save.type='submit';
  footer.append(cancel,save);form.append(footer);
  return save;
}
export function invoiceAction(db,contract,data,reload,notify){
  const {overlay,box}=createDialog('Gerar cobrança','A cobrança será vinculada ao contrato. O sistema impedirá duplicatas da mesma competência.');
  const form=$('form');
  let month=null,session=null;
  if(contract.billing_model==='mensalidade'){
    month=field('Competência (mês/ano)','month',true);
    month.input.value=new Date().toISOString().slice(0,7);
    form.append(month.wrap);
  } else if(contract.billing_model==='por_sessao'){
    const p=$('div',undefined,'form-group');
    p.append($('label','Sessão realizada'));
    session=$('select',undefined,'input');session.required=true;
    session.append(new Option('Selecione a sessão...',''));
    const times=(data.appointments||[])
      .filter(a=>a.active&&a.status==='realizado'&&a.contract_id===contract.id)
      .sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    for(const a of times){
      const date=new Date(a.starts_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
      session.append(new Option(date+' · '+(data.patients.find(p=>p.id===a.patient_id)?.name||'Paciente'),a.id));
    }
    p.append(session);form.append(p);
    if(!times.length)form.append($('p','Nenhuma sessão realizada e vinculada a este contrato.','notice bad'));
  } else {
    form.append($('p','Pacote: será gerada uma única cobrança com vencimento no início do contrato.','muted'));
  }
  const save=actions(form,overlay);
  form.addEventListener('submit',async e=>{
    e.preventDefault();save.disabled=true;
    const period=month?month.input.value+'-01':contract.starts_on;
    const {error}=await db.rpc('generate_contract_receivable',{
      p_contract_id:contract.id,p_period:period,p_appointment_id:session?.value||null
    });
    save.disabled=false;
    if(error){notify('Não foi possível gerar a cobrança: '+error.message,true);return;}
    overlay.remove();notify('Cobrança disponível em Contas a receber (sem duplicação).');await reload();
  });
  box.append(form);
  form.querySelector('input,select')?.focus();
}
export function recurringExpenseAction(db,expense,reload,notify){
  const {overlay,box}=createDialog('Gerar próxima despesa','Gera o próximo lançamento sem alterar ou pagar automaticamente a despesa anterior.');
  const form=$('form');
  const month=field('Competência de destino','month',true);
  const [year,monthNumber]=expense.due_on.split('-').map(Number);
  const next=new Date(year,monthNumber-1+(expense.recurrence==='anual'?12:1),1,12);
  month.input.value=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0')].join('-');
  form.append(month.wrap);
  const save=actions(form,overlay);
  form.addEventListener('submit',async e=>{
    e.preventDefault();save.disabled=true;
    const {error}=await db.rpc('generate_recurring_expense',{
      p_expense_id:expense.id,p_next_date:month.input.value+'-01'
    });
    save.disabled=false;
    if(error){notify('Erro ao gerar despesa: '+error.message,true);return;}
    overlay.remove();notify('Despesa gerada com sucesso.');await reload();
  });
  box.append(form);month.input.focus();
}
export async function reverseReceiptAction(db,receipt,reload,notify){
  const {overlay,box}=createDialog('Estornar recebimento','Este lançamento continuará no histórico. O valor deixará de contar no saldo recebido.');
  const form=$('form');
  const input=field('Justificativa obrigatória (mínimo 5 caracteres)','text',true);
  input.input.minLength=5;input.input.maxLength=500;
  form.append(input.wrap);
  const save=actions(form,overlay);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!confirm('Confirmar estorno? A ação ficará registrada e não poderá ser desfeita.'))return;
    save.disabled=true;
    const {error}=await db.from('receipt_reversals')
      .insert({receipt_id:receipt.id,reason:input.input.value.trim()});
    save.disabled=false;
    if(error){notify('Estorno não efetuado: '+error.message,true);return;}
    overlay.remove();notify('Recebimento estornado com justificativa.');await reload();
  });
  box.append(form);input.input.focus();
}
export function weeklyDetails(data,container) {
  const heading=$('h2','Relatório semanal por profissional');
  const label=$('label','Início da semana','report-label');
  const week=$('input',undefined,'input report-date');week.type='date';
  const today=new Date();today.setDate(today.getDate()-((today.getDay()+6)%7));
  week.value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const summary=$('div',undefined,'table-wrap');
  const problems=$('div',undefined,'table-wrap');
  const stopped=$('div',undefined,'table-wrap');
  const section=$('section',undefined,'report-detail');
  section.append(heading,label,week,$('h3','Atendimentos por profissional'),summary,
    $('h3','Cancelamentos e faltas'),problems,
    $('h3','Pacientes que interromperam o tratamento'),stopped);
  container.append(section);
  const asTable=(headers,rows)=>{
    const table=$('table');const thead=$('thead');const tr=$('tr');
    headers.forEach(x=>tr.append($('th',x)));thead.append(tr);table.append(thead);
    const body=$('tbody');
    for(const values of rows){const row=$('tr');values.forEach(x=>row.append($('td',x)));body.append(row);}
    if(!rows.length){const row=$('tr');const td=$('td','Nenhum registro encontrado.');td.colSpan=headers.length;row.append(td);body.append(row);}
    table.append(body);return table;
  };
  const name=(collection,id)=>data[collection].find(x=>x.id===id)?.name||'Não identificado';
  function show() {
    const from=new Date(week.value+'T00:00:00');if(Number.isNaN(from.getTime()))return;
    const to=new Date(from);to.setDate(from.getDate()+7);
    const attended=data.appointments.filter(a=>a.active&&new Date(a.starts_at)>=from&&new Date(a.starts_at)<to);
    const grouped=data.professionals.filter(p=>p.active).map(p=>{
      const mine=attended.filter(a=>a.professional_id===p.id);
      return [p.name,String(mine.filter(a=>a.status==='realizado').length),
        String(mine.filter(a=>a.status==='cancelado').length),
        String(mine.filter(a=>a.status==='falta').length)];
    });
    summary.replaceChildren(asTable(['Profissional','Realizados','Cancelados','Faltas'],grouped));
    const missed=attended.filter(a=>['cancelado','falta'].includes(a.status))
      .map(a=>[name('patients',a.patient_id),name('professionals',a.professional_id),
       new Date(a.starts_at).toLocaleDateString('pt-BR'),a.status,a.notes||'—']);
    problems.replaceChildren(asTable(['Paciente','Profissional','Dia','Situação','Observação'],missed));
    const fromDate=week.value;
    const toDate=[to.getFullYear(),String(to.getMonth()+1).padStart(2,'0'),String(to.getDate()).padStart(2,'0')].join('-');
    const left=data.patients.filter(p=>p.end_date&&p.end_date>=fromDate&&p.end_date<toDate)
      .map(p=>[p.name,new Date(p.end_date+'T12:00:00').toLocaleDateString('pt-BR'),p.notes||'—']);
    stopped.replaceChildren(asTable(['Paciente','Último dia registrado','Observação'],left));
  }
  week.addEventListener('change',show);show();
}
