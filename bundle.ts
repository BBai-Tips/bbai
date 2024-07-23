import { bundle } from 'emit';

const result = await bundle(
	//new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
	'api/src/main.ts',
	{
		importMap: './import_map.json',
	},
);

const { code } = result;
console.log(code);
