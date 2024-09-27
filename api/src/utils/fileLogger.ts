// Redirect console.log and console.error to the api log file
export const apiFileLogger = async (apiLogFile: string) => {
	const apiLogFileStream = await Deno.open(apiLogFile, { write: true, create: true, append: true });
	const encoder = new TextEncoder();

	const consoleFunctions = ['log', 'debug', 'info', 'warn', 'error'];
	consoleFunctions.forEach((funcName) => {
		(console as any)[funcName] = (...args: unknown[]) => {
			const timestamp = new Date().toISOString();
			const prefix = funcName === 'log' ? '' : `[${funcName.toUpperCase()}] `;
			const message = `${timestamp} ${prefix}${
				args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')
			}\n`;
			apiLogFileStream.write(encoder.encode(message));
		};
	});

	// Redirect Deno.stderr to the log file
	const originalStderrWrite = Deno.stderr.write;
	Deno.stderr.write = (p: Uint8Array): Promise<number> => {
		apiLogFileStream.write(p);
		return originalStderrWrite.call(Deno.stderr, p);
	};
};
