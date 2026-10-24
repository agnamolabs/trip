import test from 'node:test';
import assert from 'node:assert/strict';
import {apiRequest,credentials} from '../prototypes/trip-mobile/src/integration-api.ts';
test('an old request returning 401 cannot clear a newer signed-in session',async()=>{
 const original=globalThis.fetch;let resolve;globalThis.fetch=()=>new Promise(r=>resolve=r);
 try{credentials.token='older-session';credentials.user='Older';const pending=apiRequest('/api/tools/chat',{query:'test'});credentials.token='newer-session';credentials.user='Newer';resolve(Response.json({error:'Expired session'},{status:401}));await assert.rejects(pending,/Expired session/);assert.equal(credentials.token,'newer-session');assert.equal(credentials.user,'Newer')}finally{globalThis.fetch=original;credentials.token='';credentials.user=''}
});
test('a current request returning 401 clears that expired session and request keys',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Sign in'},{status:401});
 try{credentials.token='expired';credentials.user='User';credentials.groupId='group';credentials.keys.sonar='request-only-key';await assert.rejects(apiRequest('/api/tools/chat',{query:'test'}),/Sign in/);assert.equal(credentials.token,'');assert.equal(credentials.user,'');assert.equal(credentials.groupId,'');assert.equal(credentials.keys.sonar,'')}finally{globalThis.fetch=original}
});
