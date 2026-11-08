export function maskPhone(input) {
  const digits=String(input??'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'').slice(0,11);
  if(!digits)return '';
  if(digits.length<=2)return '('+digits;
  if(digits.length<=6)return '('+digits.slice(0,2)+') '+digits.slice(2);
  if(digits.length<=10)return '('+digits.slice(0,2)+') '+digits.slice(2,6)+'-'+digits.slice(6);
  return '('+digits.slice(0,2)+') '+digits.slice(2,7)+'-'+digits.slice(7);
}
export function maskPix(value,type){
  const raw=String(value??'');
  if(type==='cpf'){
    const d=raw.replace(/\D/g,'').slice(0,11);
    return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  if(type==='cnpj'){
    const d=raw.replace(/\D/g,'').slice(0,14);
    return d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
      .replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  if(type==='celular')return '+55 '+maskPhone(raw.replace(/^\+?55/,''));
  if(type==='aleatoria')return raw.replace(/[^a-zA-Z0-9-]/g,'').slice(0,36).toLowerCase();
  return raw.trim();
}
export function normalizePix(value,type){
  const raw=String(value??'').trim();
  if(!raw)return null;
  if(type==='cpf'||type==='cnpj')return raw.replace(/\D/g,'');
  if(type==='celular')return '+55'+raw.replace(/\D/g,'').replace(/^55(?=\d{11}$)/,'').slice(-11);
  if(type==='email')return raw.toLowerCase();
  return raw.toLowerCase();
}
export function isValidPix(value,type){
  const norm=normalizePix(value,type);
  if(!norm)return false;
  if(type==='cpf')return /^\d{11}$/.test(norm);
  if(type==='cnpj')return /^\d{14}$/.test(norm);
  if(type==='celular')return /^\+55\d{11}$/.test(norm);
  if(type==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm);
  if(type==='aleatoria')return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(norm);
  return false;
}
