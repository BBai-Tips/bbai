import { Context } from '@oak/oak';

export const addFile = async (
    { response }: { response: Context['response'] }
) => {
    // Add file to conversation
    response.body = { message: 'File added to conversation' };
};

export const removeFile = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Remove file from conversation
    response.body = { message: `File ${params.id} removed from conversation` };
};

export const listFiles = async (
    { response }: { response: Context['response'] }
) => {
    // List files in conversation
    response.body = { message: 'Files in conversation listed' };
};
