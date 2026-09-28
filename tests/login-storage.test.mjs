import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoginStorage} from '../login-storage.js';
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('login normal fica na aba; manter conectado sobrevive a uma nova aba',()=>{
 const local=storage(),session=storage(),a=createLoginStorage(local,session);
 a.storage.setItem('session','temporary');assert.equal(local.getItem('session'),null);assert.equal(createLoginStorage(local,storage()).storage.getItem('session'),null);
 a.setPersistent(true);a.storage.setItem('session','persistent');assert.equal(session.getItem('session'),null);assert.equal(createLoginStorage(local,storage()).storage.getItem('session'),'persistent');
});
test('sair remove sessão dos dois locais mas preserva usuário lembrado',()=>{
 const local=storage(),session=storage(),a=createLoginStorage(local,session);a.rememberUsername('ana.silva');a.setPersistent(true);a.storage.setItem('session','token');session.setItem('session','old');a.storage.removeItem('session');assert.equal(local.getItem('session'),null);assert.equal(session.getItem('session'),null);assert.equal(a.preferences().username,'ana.silva');a.rememberUsername('');assert.equal(a.preferences().username,'');
});
test('desmarcar manter conectado remove sessão persistente no próximo login',()=>{
 const local=storage(),session=storage(),a=createLoginStorage(local,session);a.setPersistent(true);a.storage.setItem('session','old');a.setPersistent(false);a.storage.setItem('session','new');assert.equal(local.getItem('session'),null);assert.equal(session.getItem('session'),'new');assert.equal(createLoginStorage(local,storage()).storage.getItem('session'),null);
});
