// Migration-only verifiers preserve existing accounts when server account configuration is absent.
// Passwords never ship in HTML or source. Explicit server configuration always wins.
const legacyVerifiers={"Vrinda":"08086d5e55464b49767bcb7d86170689ab57dcfd4a657df303ec31c1c0fe2f3f","Gabe":"fd20391303dc1ee6f272d9fc053ab26573e6a8ed7470eb5819e11f989c6d7aea","Lux":"dcc83933ee43915b0e8948cd94958ed33a17b1fac749e156f2ba87bb3ed2eb86","Kian":"65324302144688d4fccd589ed52bf1804426f6e2e74027a079005183a79a64f5"};
export async function authenticateTrip(env,user,password,verifiers=legacyVerifiers) {
 if(typeof user!=='string'||typeof password!=='string'||password.length>256)return false;
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
