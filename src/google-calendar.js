// Google Calendar via Google Identity Services (OAuth token popup).
// Escopo somente leitura. Token somente em memória; nenhum segredo Google no Supabase.
const GOOGLE_SCOPE='https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_ENDPOINT='https://www.googleapis.com/calendar/v3';
let accessToken=null;
let tokenExpiresAt=0;
const h=(tag,text,className)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=String(text);
  if(className)element.className=className;
  return element;
};
function button(label,onClick,kind='secondary'){
  const el=h('button',label,'btn '+kind);el.type='button';
  el.addEventListener('click',onClick);return el;
}
function select(options,empty='Selecione...'){
  const s=h('select',undefined,'input');
  s.append(new Option(empty,''));
  for(const [value,label] of options)s.append(new Option(label,value));
  return s;
}
function label(title,field){
  const wrap=h('label',undefined,'google-field');
  wrap.append(h('span',title),field);return wrap;
}
function dateString(date){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function localTime(iso){
  return new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
}
function normalized(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
}
async function api(path,params={}){
  if(!accessToken||Date.now()>tokenExpiresAt)throw Error('A autorização Google expirou. Clique em Conectar Google novamente.');
  const url=new URL(GOOGLE_ENDPOINT+path);
  Object.entries(params).forEach(([key,value])=>{
    if(value!==null&&value!==undefined)url.searchParams.set(key,String(value));
  });
  const response=await fetch(url,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
  if(!response.ok){
    if(response.status===401){accessToken=null;throw Error('O acesso ao Google expirou. Conecte novamente.');}
    if(response.status===403)throw Error('A conta Google não tem acesso a esta agenda ou a API Google Calendar não está ativada.');
    throw Error('Google Agenda retornou HTTP '+response.status+'.');
  }
  return response.json();
}
async function fetchCalendars(){
  const items=[];let pageToken;
  for(let page=0;page<5;page++){
    const response=await api('/users/me/calendarList',{maxResults:250,pageToken});
    items.push(...response.items||[]);
    if(!response.nextPageToken)break;
    pageToken=response.nextPageToken;
  }
  return items.filter(x=>x.id && x.accessRole!=='freeBusyReader')
    .sort((a,b)=>(a.summary||'').localeCompare(b.summary||'','pt-BR'));
}
async function fetchEvents(calId,timeMin,timeMax){
  const items=[];let pageToken=null;let limitReached=false;
  for(let page=0;page<5;page++){
    const response=await api('/calendars/'+encodeURIComponent(calId)+'/events',{
      timeMin,timeMax,maxResults:250,singleEvents:'true',orderBy:'startTime',
      showDeleted:'false',pageToken
    });
    items.push(...response.items||[]);
    if(!response.nextPageToken)break;
    if(page===4){limitReached=true;break;}
    pageToken=response.nextPageToken;
  }
  return {events:items.filter(e=>e.id && e.status!=='cancelled' && e.start?.dateTime),limitReached};
}
function canUseClient(clientId){
  return /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId||'');
}
function oauth(clientId,onSuccess,onFailure){
  if(!window.google?.accounts?.oauth2?.initTokenClient){
    onFailure('A biblioteca do Google ainda não carregou. Atualize a página e tente novamente.');
    return;
  }
  const client=window.google.accounts.oauth2.initTokenClient({
    client_id:clientId,scope:GOOGLE_SCOPE,
    callback:response=>{
      if(response?.error||!response?.access_token){
        onFailure('O Google não concedeu acesso ao calendário: '+(response?.error||'resposta vazia'));
        return;
      }
      accessToken=response.access_token;
      tokenExpiresAt=Date.now()+Math.max(0,Number(response.expires_in||3600)-60)*1000;
      void onSuccess();
    },
    error_callback:response=>onFailure('A janela Google foi cancelada ou bloqueada: '+(response?.type||'erro desconhecido'))
  });
  client.requestAccessToken({prompt:'consent'});
}
async function optionsFromDb(db){
  const [pros,services,links,setting]=await Promise.all([
    db.from('professionals').select('id,name,active').order('name'),
    db.from('services').select('id,name,active').order('name'),
    db.from('calendar_links').select('*'),
    db.from('google_calendar_settings').select('oauth_client_id').eq('id',1).maybeSingle()
  ]);
  for(const r of [pros,services,links,setting])if(r.error)throw Error('Não foi possível carregar a configuração da agenda: '+r.error.message);
  return {
    professionals:(pros.data||[]).filter(p=>p.active),
    services:(services.data||[]).filter(p=>p.active),
    links:links.data||[],
    clientId:setting.data?.oauth_client_id||''
  };
}
export async function renderGoogleCalendar(db,target,notify,role='staff'){
  target.replaceChildren(h('p','Carregando integração Google…','muted'));
  let config;
  try{config=await optionsFromDb(db);}
  catch(error){target.replaceChildren(h('p',error.message,'notice bad'));return;}
  target.replaceChildren();
  const root=h('section',undefined,'card');
  root.append(h('h2','Google Agenda — importar compromissos'),
    h('p','Conecte a conta que já possui acesso às agendas da clínica. O Google continua como fonte dos horários; o sistema importa apenas eventos selecionados, inicialmente como agendados, sem marcar presença ou gerar cobrança.','muted'));
  const status=h('p',undefined,'notice');status.hidden=true;
  function feedback(message,isError=false){status.hidden=false;status.className=isError?'notice bad':'notice';status.textContent=message;notify(message,isError);}
  root.append(status);
  if(role==='admin'){
    const configCard=h('div',undefined,'google-config');
    configCard.append(h('h3','Configuração inicial do Google'));
    configCard.append(h('p','O Google precisa de um ID OAuth de aplicativo Web. Não é senha nem client secret. O ID público é salvo no Supabase para a equipe autorizada.','muted'));
    const clientInput=h('input',undefined,'input');clientInput.type='text';clientInput.value=config.clientId;
    clientInput.placeholder='123456789-xxxx.apps.googleusercontent.com';
    clientInput.autocomplete='off';clientInput.spellcheck=false;
    const save=button('Salvar ID OAuth',async()=>{
      const clientId=clientInput.value.trim();
      if(!canUseClient(clientId)){feedback('Informe um Client ID Google válido (termina com .apps.googleusercontent.com).',true);return;}
      save.disabled=true;
      const {error}=await db.from('google_calendar_settings').upsert({id:1,oauth_client_id:clientId},{onConflict:'id'});
      save.disabled=false;
      if(error){feedback('Falha ao salvar configuração: '+error.message,true);return;}
      config.clientId=clientId;feedback('ID OAuth configurado. Agora clique em Conectar Google.');
      connect.disabled=false;
    });
    const guide=h('p',undefined,'muted');
    guide.append('Crie o Client ID em ',
      (()=>{const a=h('a','Google Cloud → Auth Platform → Clients');a.href='https://console.cloud.google.com/auth/clients';a.target='_blank';a.rel='noopener noreferrer';return a;})(),
      '. Ative Google Calendar API, habilite consentimento e autorize a origem JavaScript https://https-maria.github.io .');
    configCard.append(label('ID do cliente OAuth',clientInput),save,guide);
    root.append(configCard);
  }
  const actions=h('div',undefined,'actions google-actions');
  const connect=button('Conectar Google',()=>{
    if(!canUseClient(config.clientId)){feedback('Configure primeiro um ID OAuth do Google.',true);return;}
    connect.disabled=true;
    oauth(config.clientId,async()=>{
      try{
        feedback('Conexão Google autorizada. Carregando calendários…');
        config.calendars=await fetchCalendars();
        feedback(config.calendars.length+' calendário(s) disponível(is) nesta conta Google.');
        showCalendars();
      }catch(error){feedback(error.message,true);}
      finally{connect.disabled=false;}
    },error=>{feedback(error,true);connect.disabled=false;});
  },'');
  connect.disabled=!canUseClient(config.clientId);
  actions.append(connect);
  const disconnect=button('Desconectar esta sessão',()=>{
    if(accessToken && window.google?.accounts?.oauth2?.revoke){
      window.google.accounts.oauth2.revoke(accessToken,()=>{});
    }
    accessToken=null;tokenExpiresAt=0;config.calendars=null;
    calendarArea.replaceChildren();feedback('Conexão desta sessão encerrada.');
  });
  actions.append(disconnect);
  root.append(actions);
  const calendarArea=h('div');root.append(calendarArea);target.append(root);
  if(!config.clientId){
    const message=h('p','Ainda não foi configurado um Client ID Google. Depois de criar um aplicativo OAuth Web no Google Cloud, informe o ID acima.','notice bad');
    root.append(message);
  }
  function showCalendars(){
    calendarArea.replaceChildren();
    const calendars=config.calendars||[];
    if(!calendars.length){calendarArea.append(h('p','Nenhum calendário legível foi encontrado. Confira o compartilhamento na conta Google.'));return;}
    calendarArea.append(h('h3','Agendas disponíveis'),
      h('p','Associe cada agenda ao profissional correspondente. Uma profissional pode ter várias agendas, inclusive por serviço.','muted'));
    const list=h('div',undefined,'google-calendar-list');
    calendars.forEach(cal=>{
      const mapping=config.links.find(l=>l.google_calendar_id===cal.id&&l.active);
      const row=h('div',undefined,'google-calendar-row');
      row.append(h('strong',cal.summary||cal.id),h('span',cal.id,'google-id'));
      const prof=select(config.professionals.map(p=>[p.id,p.name]),'Escolha o profissional');
      const service=select(config.services.map(s=>[s.id,s.name]),'Serviço opcional');
      prof.value=mapping?.professional_id||'';
      service.value=mapping?.service_id||'';
      row.append(label('Profissional',prof),label('Serviço',service));
      if(role==='admin'){
        const save=button(mapping?'Atualizar vínculo':'Salvar vínculo',async()=>{
          if(!prof.value){feedback('Escolha o profissional antes de vincular a agenda.',true);return;}
          save.disabled=true;
          const payload={google_calendar_id:cal.id,display_name:cal.summary||cal.id,
            professional_id:prof.value,service_id:service.value||null,active:true};
          const {error}=await db.from('calendar_links').upsert(payload,{onConflict:'google_calendar_id'});
          save.disabled=false;
          if(error){feedback('Erro ao vincular agenda: '+error.message,true);return;}
          const ix=config.links.findIndex(x=>x.google_calendar_id===cal.id);
          if(ix>=0)config.links[ix]=payload;else config.links.push(payload);
          feedback('Agenda vinculada. Agora você pode visualizar os eventos.');
        });
        row.append(save);
      }
      row.append(button('Ver eventos',()=>{
        const selected=config.links.find(x=>x.google_calendar_id===cal.id&&x.active);
        if(!selected){feedback('Vincule esta agenda a um profissional antes de importar eventos.',true);return;}
        void showEvents(cal,selected);
      }));
      list.append(row);
    });
    calendarArea.append(list);
    const eventsArea=h('div',undefined,'google-events-area');calendarArea.append(eventsArea);
    async function showEvents(cal,mapping){
      eventsArea.replaceChildren(h('p','Selecione o período e carregue os eventos.','muted'));
      const panel=h('section',undefined,'google-events');
      panel.append(h('h3','Eventos: '+(cal.summary||cal.id)));
      const range=h('div',undefined,'google-range');
      const from=h('input',undefined,'input');from.type='date';
      const to=h('input',undefined,'input');to.type='date';
      const today=new Date(),future=new Date();
      today.setDate(today.getDate()-7);future.setDate(future.getDate()+30);
      from.value=dateString(today);to.value=dateString(future);
      range.append(label('De',from),label('Até',to));
      const results=h('div');panel.append(range,button('Buscar eventos',()=>{void loadEvents();},''),results);
      eventsArea.replaceChildren(panel);
      async function loadEvents(){
        results.replaceChildren(h('p','Consultando Google Agenda…','muted'));
        if(!from.value||!to.value||from.value>to.value){
          results.replaceChildren(h('p','Escolha um período válido.','notice bad'));return;
        }
        const start=new Date(from.value+'T00:00:00'),end=new Date(to.value+'T00:00:00');
        if((end-start)/86400000>92){results.replaceChildren(h('p','Selecione no máximo 92 dias.','notice bad'));return;}
        end.setDate(end.getDate()+1);
        let fetched,existing,patients;
        try{
          [fetched,existing,patients]=await Promise.all([
            fetchEvents(cal.id,start.toISOString(),end.toISOString()),
            db.from('appointments').select('google_event_id').eq('google_calendar_id',cal.id)
              .gte('starts_at',start.toISOString()).lt('starts_at',end.toISOString()).limit(1000),
            db.from('patients').select('id,name,active,deleted_at').is('deleted_at',null).eq('active',true).order('name').limit(1000)
          ]);
          if(existing.error)throw existing.error;
          if(patients.error)throw patients.error;
        }catch(error){results.replaceChildren(h('p',error.message,'notice bad'));return;}
        const registered=new Set((existing.data||[]).map(x=>x.google_event_id));
        const persons=patients.data||[];
        const events=fetched.events.slice(0,250);
        results.replaceChildren(h('p',events.length+' evento(s) exibido(s). '+(fetched.limitReached||fetched.events.length>250?'Há mais eventos; reduza o período para consultar todos.':''),
          'muted'));
        if(!events.length)return;
        const tableWrap=h('div',undefined,'table-wrap'),table=h('table');
        const header=h('tr');['Importar','Data e horário','Título no Google','Paciente no sistema','Situação'].forEach(x=>header.append(h('th',x)));
        const thead=h('thead');thead.append(header);table.append(thead);
        const body=h('tbody');const selections=[];
        events.forEach(event=>{
          const already=registered.has(event.id);
          const row=h('tr');
          const check=h('input');check.type='checkbox';check.disabled=already;check.setAttribute('aria-label','Selecionar '+(event.summary||'evento'));
          const patient=select(persons.map(p=>[p.id,p.name]),'Sem vínculo com paciente');
          // Sugestão por correspondência exata, mas somente salva após confirmação explícita.
          const matches=persons.filter(p=>normalized(p.name)===normalized(event.summary));
          if(matches.length===1)patient.value=matches[0].id;
          patient.disabled=already;
          const mark=h('td');mark.append(check);
          const patientCell=h('td');patientCell.append(patient);
          const state=h('td',already?'Já importado':'Novo');
          row.append(mark,h('td',localTime(event.start.dateTime)),h('td',event.summary||'(sem título)'),patientCell,state);
          body.append(row);
          selections.push({event,check,patient,already});
        });
        table.append(body);tableWrap.append(table);results.append(tableWrap);
        results.append(button('Importar eventos selecionados',async()=>{
          const checked=selections.filter(x=>x.check.checked&&!x.already);
          if(!checked.length){feedback('Marque pelo menos um evento para importar.',true);return;}
          if(checked.length>100){feedback('Importe até 100 eventos por operação.',true);return;}
          if(!confirm('Importar '+checked.length+' evento(s) como agendados? Eventos sem paciente ficarão pendentes de vínculo.'))return;
          let added=0,duplicate=0,failed=0;
          for(const item of checked){
            const ev=item.event;
            const payload={
              google_calendar_id:cal.id,google_event_id:ev.id,
              google_title:(ev.summary||'(sem título)').slice(0,255),
              google_last_seen_at:new Date().toISOString(),
              starts_at:new Date(ev.start.dateTime).toISOString(),
              ends_at:ev.end?.dateTime?new Date(ev.end.dateTime).toISOString():null,
              status:'agendado',source:'google',active:true,
              professional_id:mapping.professional_id,service_id:mapping.service_id,
              patient_id:item.patient.value||null
            };
            const {error}=await db.from('appointments').insert(payload);
            if(!error){added++;item.check.checked=false;item.check.disabled=true;}
            else if(error.code==='23505')duplicate++;
            else{failed++;console.error('Falha ao importar evento',error.code);}
          }
          feedback('Importados: '+added+'. Duplicados ignorados: '+duplicate+'. Erros: '+failed+(failed?'. Verifique permissões e vínculos.':''));
          if(added||duplicate)await loadEvents();
        },''));
      }
    }
  }
}
