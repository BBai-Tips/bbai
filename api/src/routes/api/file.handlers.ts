import { Context } from '@oak/oak';

export const addFile = async (ctx: Context) => {
    // Add file to conversation
    ctx.response.body = { message: 'File added to conversation' };
};

export const removeFile = async (ctx: Context) => {
    // Remove file from conversation
    const id = (ctx.params as { id: string }).id;
    ctx.response.body = { message: `File ${id} removed from conversation` };
};

export const listFiles = async (ctx: Context) => {
    // List files in conversation
    ctx.response.body = { message: 'Files in conversation listed' };
};
