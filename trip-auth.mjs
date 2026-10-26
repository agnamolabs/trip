// Migration-only verifiers preserve existing accounts when server account configuration is absent.
// Passwords never ship in HTML or source. Explicit server configuration always wins.
const legacyVerifiers={"Vrinda":"08086d5e55464b49767bcb7d86170689ab57dcfd4a657df303ec31c1c0fe2f3f","Gabe":"fd20391303dc1ee6f272d9fc053ab26573e6a8ed7470eb5819e11f989c6d7aea","Lux":"dcc83933ee43915b0e8948cd94958ed33a17b1fac749e156f2ba87bb3ed2eb86","Kian":"65324302144688d4fccd589ed52bf1804426f6e2e74027a079005183a79a64f5"};
export async function authenticateTrip(env,user,password,verifiers=legacyVerifiers) {
 if(typeof user!=='string'||typeof password!=='string'||password.length>256)return false;
 if(await accountPasswordMatches(env,user,password))return true;
 if(env.TRIP_DB){let hasAccount=false;try{hasAccount=!!(await env.TRIP_DB.prepare('SELECT 1 AS present FROM accounts WHERE user_id=?').bind(user).first())}catch{}
  if(hasAccount)return false;}
 if(env.TRIP_AUTH_USERS){
  let accounts;try{accounts=JSON.parse(env.TRIP_AUTH_USERS)}catch{throw Object.assign(new Error('Server authentication is not configured'),{status:503})}
  if(!accounts||typeof accounts!=='object'||Array.isArray(accounts))throw Object.assign(new Error('Server authentication is not configured'),{status:503});
  return Object.hasOwn(accounts,user)&&typeof accounts[user]==='string'&&accounts[user]===password;
 }
 if(!Object.hasOwn(verifiers,user))return false;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('trip-legacy:'+user+':'+password));
 const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 let difference=0;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^verifiers[user].charCodeAt(i);
 return difference===0;
}

export function knownAccountNames(env) {
 if(!env.TRIP_AUTH_USERS)return Object.keys(legacyVerifiers);
 try{const accounts=JSON.parse(env.TRIP_AUTH_USERS);return accounts&&typeof accounts==='object'&&!Array.isArray(accounts)?Object.keys(accounts):[]}catch{return []}
}
// Accounts live in D1 (created by an owner) so a trip can be shared with people who
// never had a legacy password. Passwords are PBKDF2-SHA256, never stored in clear.
const hexOf=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function pbkdf2(password,saltHex,iterations){
 const salt=Uint8Array.from((saltHex.match(/../g)||[]).map(h=>parseInt(h,16)));
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,256);
 return hexOf(bits);
}
export async function hashPassword(password){
 const salt=hexOf(crypto.getRandomValues(new Uint8Array(16)));const iterations=100000;
 return {salt,iterations,hash:await pbkdf2(password,salt,iterations)};
}
export async function knownAccounts(env){
 if(!env?.TRIP_DB)return [];
 try{const rows=await env.TRIP_DB.prepare('SELECT user_id FROM accounts ORDER BY user_id').all();return (rows.results||[]).map(row=>row.user_id)}catch{return []}
}
let accountsReady=false;
async function ensureAccounts(env){
 if(accountsReady||!env?.TRIP_DB)return;
 await env.TRIP_DB.prepare("CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY,role TEXT NOT NULL DEFAULT 'Member',salt TEXT NOT NULL,iterations INTEGER NOT NULL DEFAULT 100000,password_hash TEXT NOT NULL,created_at TEXT NOT NULL)").run();
 accountsReady=true;
}
export async function addAccount(env,user,password,role='Member'){
 if(!env?.TRIP_DB)throw Object.assign(new Error('Account storage is not configured'),{status:503});
 await ensureAccounts(env);
 if(typeof user!=='string'||!/^[A-Za-z0-9 ._-]{2,40}$/.test(user.trim()))throw Object.assign(new Error('Use 2-40 letters, numbers, spaces, dots, dashes or underscores'),{status:400});
 if(typeof password!=='string'||password.length<8||password.length>200)throw Object.assign(new Error('Use a password of 8-200 characters'),{status:400});
 const name=user.trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
 const {salt,iterations,hash}=await hashPassword(password);
 await env.TRIP_DB.prepare('INSERT INTO accounts (user_id, role, salt, iterations, password_hash, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET salt=excluded.salt, iterations=excluded.iterations, password_hash=excluded.password_hash, role=excluded.role')
  .bind(name,role,salt,iterations,hash,new Date().toISOString()).run();
 return {user:name,role};
}
export async function deleteAccount(env,user){
 if(!env?.TRIP_DB)throw Object.assign(new Error('Account storage is not configured'),{status:503});
 await env.TRIP_DB.prepare('DELETE FROM accounts WHERE user_id=?').bind(user).run();
 return {ok:true};
}
async function accountPasswordMatches(env,user,password){
 if(!env?.TRIP_DB||typeof user!=='string')return false;
 let row;try{row=await env.TRIP_DB.prepare('SELECT salt, iterations, password_hash FROM accounts WHERE user_id=?').bind(user).first()}catch{return false}
 if(!row?.password_hash)return false;
 const actual=await pbkdf2(password,row.salt,Number(row.iterations)||100000);
 let difference=0;
 for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^String(row.password_hash).charCodeAt(i);
 return difference===0&&actual.length===String(row.password_hash).length;
}
