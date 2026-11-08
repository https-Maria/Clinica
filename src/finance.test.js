import test from 'node:test';
import assert from 'node:assert/strict';
import { divideRecebimento } from './finance.js';
test('padrão 60/40',()=>assert.deepEqual(divideRecebimento(1000,40),{clinica:600,profissional:400}));
test('exceção de contrato 55/45',()=>assert.deepEqual(divideRecebimento(200,45),{clinica:110,profissional:90}));
test('conserva centavos mesmo em valores pequenos',()=>{
  const result=divideRecebimento(0.01,40);
  assert.equal(Math.round((result.clinica+result.profissional)*100),1);
});
test('não aceita percentual acima de 100',()=>assert.throws(()=>divideRecebimento(80,101),RangeError));
test('não aceita valores negativos',()=>assert.throws(()=>divideRecebimento(-10,40),RangeError));
