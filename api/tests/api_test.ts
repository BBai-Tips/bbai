import { assertEquals, assertObjectMatch, delay } from './deps.ts';
import { app } from '../src/main.ts';
import { superoak } from 'superoak';
import ProjectEditor from '../src/editor/projectEditor.ts';
import { ConversationId } from 'shared/types.ts';

// Mock ProjectEditor
class MockProjectEditor {
	async init() {}
	async getProjectRoot() {
		return '/mock/project/root';
	}
}

// Replace ProjectEditor with MockProjectEditor
(globalThis as any).ProjectEditor = MockProjectEditor;

Deno.test({
	name: 'API root endpoint returns correct message',
	fn: async () => {
		const controller = new AbortController();
		const { signal } = controller;

		try {
			const request = await superoak(app);
			await request.get('/')
				.expect(200)
				.expect('Content-Type', /json/)
				.expect({ message: 'Welcome to BBai API', docs: '/api-docs/openapi.json' });
		} finally {
			controller.abort();
			await delay(0); // Allow any pending microtasks to complete
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'API status endpoint returns OK',
	fn: async () => {
		const request = await superoak(app);
		const response = await request
			.get('/api/v1/status')
			.expect(200)
			.expect('Content-Type', /json/);

		assertEquals(response.body.status, 'OK');
		assertEquals(response.body.message, 'API is running');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

// NOT IMPLEMENTED - missing project root and other deps not configured during testing

/*
let conversationId: ConversationId;
Deno.test("Start conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .post("/api/v1/conversation")
    .send({
      prompt: "Test prompt",
      startDir: "/test/dir"
    })
    .expect(200)
    .expect("Content-Type", /json/);

  assertObjectMatch(response.body, {
    conversationId: ConversationId,
    response: Object
  });
  conversationId = response.body.response.body;
});
 */

/*
Deno.test("Continue conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .post(`/api/v1/conversation/${conversationId}`)
    .send({
      prompt: "Continue test prompt",
      startDir: "/test/dir"
    })
    .expect(200)
    .expect("Content-Type", /json/);

  assertObjectMatch(response.body, {
    conversationId: ConversationId,
    response: Object
  });
});
 */

/*
Deno.test("Add file to conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .post("/api/v1/files")
    .field("file", "test content")
    .field("filename", "test.txt")
    .expect(200)
    .expect("Content-Type", /json/);

  assertObjectMatch(response.body, {
    message: "File added to conversation",
    conversationId: ConversationId,
    filePath: String
  });
});
 */

/*
Deno.test("List files in conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .get("/api/v1/files")
    .expect(200)
    .expect("Content-Type", /json/);

  assertObjectMatch(response.body, { files: Array });
});
 */
