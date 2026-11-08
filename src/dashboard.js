const el=(tag,text,cls)=>{
  const n=document.createElement(tag);if(text!==undefined)n.textContent=text;
  if(cls)n.className=cls;return n;
};
function dateOnly(date){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export async function dashboardPendencies(db,view,onReminders){
 const section=el('section',undefined,'card dashboard-pending');
 section.append(el('h2','Pendências e lembretes'),el('p','Conferência rápida do trabalho de hoje.','muted'));
 const cards=el('div',undefined,'cards');
 const busy=el('p','Carregando…','muted');
 section.append(busy,cards);view.append(section);
 const [notes,expenses,receivables,receipts,reversals]=await Promise.all([
   db.from('personal_reminders').select('id,title,due_at,priority').eq('active',true).is('completed_at',null).limit(200),
   db.from('expenses').select('id,amount,due_on,paid_on').eq('active',true).limit(1000),
   db.from('receivables').select('id,amount,due_on').eq('active',true).limit(1000),
   db.from('receipts').select('id,receivable_id,amount').limit(1000),
   db.from('receipt_reversals').select('receipt_id').limit(1000)
 ]);
 if(!section.isConnected)return;
 if([notes,expenses,receivables,receipts,reversals].some(x=>x.error)){
   busy.textContent='Não foi possível consultar as pendências.';
   return;
 }
 busy.remove();
 const date=dateOnly(new Date());const overdueNotes=(notes.data||[]).filter(x=>x.due_at&&new Date(x.due_at)<new Date()).length;
 const pendingExpenses=(expenses.data||[]).filter(x=>!x.paid_on&&x.due_on<=date).length;
 const reversed=new Set((reversals.data||[]).map(x=>x.receipt_id));
 const paid=new Map();
 (receipts.data||[]).filter(x=>!reversed.has(x.id)).forEach(x=>{
   paid.set(x.receivable_id,(paid.get(x.receivable_id)||0)+Number(x.amount));
 });
 const overdueInvoices=(receivables.data||[]).filter(x=>x.due_on<date&&(paid.get(x.id)||0)<Number(x.amount)-0.005).length;
 for(const [label,value] of [
   ['Meus lembretes pendentes',(notes.data||[]).length],
   ['Lembretes vencidos',overdueNotes],
   ['Despesas vencidas a conferir',pendingExpenses],
   ['Cobranças em atraso',overdueInvoices]
 ]){
   const card=el('div',undefined,'card stat');
   card.append(el('span',label,'muted'),el('strong',value));
   cards.append(card);
 }
 const b=el('button','Abrir meus lembretes','btn secondary');
 b.type='button';b.addEventListener('click',onReminders);
 section.append(b);
}
