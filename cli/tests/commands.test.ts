import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { apiStatus } from "../src/commands/apiStatus.ts";
import { apiStart } from "../src/commands/apiStart.ts";
import { apiStop } from "../src/commands/apiStop.ts";
import { init } from "../src/commands/init.ts";
import { stub } from "https://deno.land/std@0.192.0/testing/mock.ts";

// Mock console.log to capture output
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;
console.log = (...args: unknown[]) => {
  consoleOutput.push(args.join(' '));
};

// Helper function to reset console output
function resetConsoleOutput() {
  consoleOutput = [];
}

Deno.test("apiStatus command", async () => {
  resetConsoleOutput();
  
  // Mock isApiRunning and getPid
  const isApiRunningStub = stub(import("../src/utils/pid.utils.ts"), "isApiRunning", () => Promise.resolve(true));
  const getPidStub = stub(import("../src/utils/pid.utils.ts"), "getPid", () => Promise.resolve(1234));

  // Mock fetch for API status
  const fetchStub = stub(globalThis, "fetch", () => 
    Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 }))
  );

  await apiStatus.execute({ text: true });

  assertEquals(consoleOutput.length, 1);
  const output = JSON.parse(consoleOutput[0]);
  assertEquals(output.running, true);
  assertEquals(output.pid, 1234);
  assertStringIncludes(output.apiUrl, "http://localhost");
  assertEquals(output.apiStatus.status, "ok");

  isApiRunningStub.restore();
  getPidStub.restore();
  fetchStub.restore();
});

Deno.test("apiStart command", async () => {
  resetConsoleOutput();
  
  // Mock isApiRunning
  const isApiRunningStub = stub(import("../src/utils/pid.utils.ts"), "isApiRunning", () => Promise.resolve(false));

  // Mock Deno.Command
  const commandStub = stub(Deno, "Command", () => ({
    spawn: () => ({ pid: 5678 }),
  }));

  // Mock savePid
  const savePidStub = stub(import("../src/utils/pid.utils.ts"), "savePid", () => Promise.resolve());

  await apiStart.execute({});

  assertStringIncludes(consoleOutput.join('\n'), "bbai API server started with PID: 5678");

  isApiRunningStub.restore();
  commandStub.restore();
  savePidStub.restore();
});

Deno.test("apiStop command", async () => {
  resetConsoleOutput();
  
  // Mock isApiRunning and getPid
  const isApiRunningStub = stub(import("../src/utils/pid.utils.ts"), "isApiRunning", () => Promise.resolve(true));
  const getPidStub = stub(import("../src/utils/pid.utils.ts"), "getPid", () => Promise.resolve(9876));

  // Mock Deno.kill
  const killStub = stub(Deno, "kill", () => {});

  // Mock removePid
  const removePidStub = stub(import("../src/utils/pid.utils.ts"), "removePid", () => Promise.resolve());

  await apiStop.execute();

  assertStringIncludes(consoleOutput.join('\n'), "bbai API server stopped successfully");

  isApiRunningStub.restore();
  getPidStub.restore();
  killStub.restore();
  removePidStub.restore();
});

Deno.test("init command", async () => {
  resetConsoleOutput();
  
  // Mock createBbaiDir, createTagIgnore, createDefaultConfig
  const createBbaiDirStub = stub(import("../src/utils/init.utils.ts"), "createBbaiDir", () => Promise.resolve());
  const createTagIgnoreStub = stub(import("../src/utils/init.utils.ts"), "createTagIgnore", () => Promise.resolve());
  const createDefaultConfigStub = stub(import("../src/utils/init.utils.ts"), "createDefaultConfig", () => Promise.resolve());

  // Mock GitUtils.findGitRoot
  const findGitRootStub = stub(import("shared/git.ts"), "GitUtils", {
    findGitRoot: () => Promise.resolve(null),
  });

  // Mock Deno.Command for git init
  const commandStub = stub(Deno, "Command", () => ({
    output: () => Promise.resolve({ success: true, stdout: new Uint8Array(), stderr: new Uint8Array() }),
  }));

  // Mock createGitIgnore
  const createGitIgnoreStub = stub(import("../src/utils/init.utils.ts"), "createGitIgnore", () => Promise.resolve());

  await init.execute();

  assertStringIncludes(consoleOutput.join('\n'), "bbai initialization complete");

  createBbaiDirStub.restore();
  createTagIgnoreStub.restore();
  createDefaultConfigStub.restore();
  findGitRootStub.restore();
  commandStub.restore();
  createGitIgnoreStub.restore();
});

// Restore original console.log
console.log = originalConsoleLog;
