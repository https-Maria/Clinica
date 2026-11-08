import test from 'node:test';
import assert from 'node:assert/strict';
import { maskPhone,maskPix,normalizePix,isValidPix } from './formatters.js';
test('formata celular brasileiro',()=>assert.equal(maskPhone('11987654321'),'(11) 98765-4321'));
test('máscara CPF',()=>assert.equal(maskPix('12345678901','cpf'),'123.456.789-01'));
test('máscara CNPJ',()=>assert.equal(maskPix('12345678000190','cnpj'),'12.345.678/0001-90'));
test('normaliza PIX celular E.164',()=>assert.equal(normalizePix('(11) 98765-4321','celular'),'+5511987654321'));
test('validação PIX exige formato compatível',()=>{assert.equal(isValidPix('abc','cpf'),false);assert.equal(isValidPix('duda@example.com','email'),true);});
