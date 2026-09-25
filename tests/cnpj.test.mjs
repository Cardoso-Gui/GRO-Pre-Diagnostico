import test from 'node:test';
import assert from 'node:assert/strict';
import {mapCompany,lookupCompany} from '../cnpj.js';
const cnpj='19131243000197';
test('maps available data without inventing absent CNAE or responsible',()=>{const result=mapCompany({cnpj,razao_social:'Empresa',cep:'01234-567'},cnpj);assert.equal(result.cnae,'');assert.equal(result.postal_code,'01234567');assert.equal(result.contact_name,undefined);});
test('normalizes formatted CNPJ and omits credentials',async()=>{await lookupCompany('19.131.243/0001-97',async(url,options)=>{assert.ok(url.endsWith(cnpj));assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({cnpj,razao_social:'Empresa'})};});});
test('invalid input never makes request',async()=>{await assert.rejects(lookupCompany('123',()=>{throw Error('should not fetch');}),/completo/);});
test('rejects mismatched company',()=>{assert.throws(()=>mapCompany({cnpj:'00000000000000',razao_social:'Empresa'},cnpj),/incompletos/);});
test('service failures give manual fallback',async()=>{for(const status of [404,429,500])await assert.rejects(lookupCompany(cnpj,async()=>({ok:false,status})),/manual|Aguarde/);});
