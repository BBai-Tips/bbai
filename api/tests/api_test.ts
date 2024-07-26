import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { app } from "../src/main.ts";
import { superoak } from "https://deno.land/x/superoak@4.7.0/mod.ts";

Deno.test("API root endpoint returns correct message", async () => {
  const request = await superoak(app);
  await request.get("/").expect(200).expect("bbai API");
});

Deno.test("API status endpoint returns OK", async () => {
  const request = await superoak(app);
  await request
    .get("/api/v1/status")
    .expect(200)
    .expect({ status: "OK", message: "API is running" });
});

Deno.test("Start conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .post("/api/v1/conversation")
    .send({
      prompt: "Test prompt",
      startDir: "/test/dir"
    })
    .expect(200);

  assertEquals(typeof response.body.conversationId, "string");
  assertEquals(typeof response.body.response, "object");
});

Deno.test("Continue conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .post("/api/v1/conversation/test-id")
    .send({
      prompt: "Continue test prompt",
      startDir: "/test/dir"
    })
    .expect(200);

  assertEquals(typeof response.body.conversationId, "string");
  assertEquals(typeof response.body.response, "object");
});

Deno.test("Add file to conversation endpoint", async () => {
  const request = await superoak(app);
  await request
    .post("/api/v1/files")
    .field("file", "test content")
    .field("filename", "test.txt")
    .expect(200)
    .expect({ message: "File added to conversation", conversationId: "test-id", filePath: "test.txt" });
});

Deno.test("List files in conversation endpoint", async () => {
  const request = await superoak(app);
  const response = await request
    .get("/api/v1/files")
    .expect(200);

  assertEquals(Array.isArray(response.body.files), true);
});
