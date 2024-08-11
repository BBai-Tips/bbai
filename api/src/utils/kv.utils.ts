const kv = await Deno.openKv();
//const kv = await Deno.openKv("/tmp/kv.db");

export default kv;
