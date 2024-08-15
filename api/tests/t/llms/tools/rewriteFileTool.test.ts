import { assertEquals, assertThrows } from 'https://deno.land/std/testing/asserts.ts';
import { RewriteFileTool } from '../../../../src/llms/tools/rewriteFileTool.ts';
import { ensureFileSync, existsSync } from 'https://deno.land/std/fs/mod.ts';
import { resolve } from 'https://deno.land/std/path/mod.ts';

Deno.test({
  name: 'RewriteFileTool - rewrite existing file',
  async fn() {
    const tempDir = await Deno.makeTempDir();
    const testFilePath = resolve(tempDir, 'test.txt');
    ensureFileSync(testFilePath);
    await Deno.writeTextFile(testFilePath, 'Original content');

    const tool = new RewriteFileTool();
    const result = await tool.execute({
      filePath: testFilePath,
      content: 'New content',
    });

    assertEquals(result, `File ${testFilePath} has been successfully rewritten or created.`);
    const newContent = await Deno.readTextFile(testFilePath);
    assertEquals(newContent, 'New content');

    await Deno.remove(tempDir, { recursive: true });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: 'RewriteFileTool - create new file',
  async fn() {
    const tempDir = await Deno.makeTempDir();
    const testFilePath = resolve(tempDir, 'newfile.txt');

    const tool = new RewriteFileTool();
    const result = await tool.execute({
      filePath: testFilePath,
      content: 'New file content',
    });

    assertEquals(result, `File ${testFilePath} has been successfully rewritten or created.`);
    assertEquals(existsSync(testFilePath), true);
    const newContent = await Deno.readTextFile(testFilePath);
    assertEquals(newContent, 'New file content');

    await Deno.remove(tempDir, { recursive: true });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: 'RewriteFileTool - throw error for file outside project',
  async fn() {
    const tool = new RewriteFileTool();
    await assertThrows(
      () => tool.execute({
        filePath: '/tmp/outside_project.txt',
        content: 'This should fail',
      }),
      Error,
      'File path is not within the project directory'
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
