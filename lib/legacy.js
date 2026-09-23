export {json,base,random as id} from '../lib/store.js';
import {get,set,remove} from '../lib/store.js';
export {token} from '../lib/twitch.js';
export const redis=()=>({get,set:(k,v,o)=>set(k,v,o?.ex),del:remove});
