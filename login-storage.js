const SESSION_PREFERENCE='gro.keep-connected';
const USERNAME_PREFERENCE='gro.remembered-username';
export function createLoginStorage(local,session){
 const persistent=()=>local.getItem(SESSION_PREFERENCE)==='true';
 return {
  storage:{
   getItem(key){return (persistent()?local:session).getItem(key);},
   setItem(key,value){const keep=persistent();(keep?local:session).setItem(key,value);(keep?session:local).removeItem(key);},
   removeItem(key){local.removeItem(key);session.removeItem(key);}
  },
  setPersistent(value){local.setItem(SESSION_PREFERENCE,String(!!value));},
  preferences(){try{return {keepConnected:persistent(),username:local.getItem(USERNAME_PREFERENCE)||''};}catch{return {keepConnected:false,username:''};}},
  rememberUsername(value){try{if(value)local.setItem(USERNAME_PREFERENCE,value);else local.removeItem(USERNAME_PREFERENCE);}catch{/* Optional preference does not prevent login. */}}
 };
}
