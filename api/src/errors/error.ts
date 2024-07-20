import { ConversationId, LLMProvider, ErrorType, ErrorStatus, APIErrorOptions, LLMErrorOptions, LLMRateLimitErrorOptions, LLMValidationErrorOptions } from '../types.ts';
export type { ErrorObject as AjvErrorObject } from 'ajv';
import { Status as ErrorStatus } from '@oak/oak';

export enum ErrorType {
	API = 'APIError',
	LLM = 'LLMError',
	LLMRateLimit = 'RateLimitError',
	LLMValidation = 'ValidationError',
}
export const ErrorTypes = [
	ErrorType.API,
	ErrorType.LLM,
	ErrorType.LLMRateLimit,
	ErrorType.LLMValidation,
];

export interface ErrorOptions {
	name: string;
}

export interface APIErrorOptions extends ErrorOptions {
	status?: ErrorStatus;
	path?: string;
	args?: object;
	expose?: boolean;
}

export interface LLMErrorOptions extends ErrorOptions {
	provider: LLMProvider;
	model?: string;
	pipeline?: string;
	args?: object;
	conversationId: ConversationId;
}

export interface LLMRateLimitErrorOptions extends LLMErrorOptions {
	token_usage?: number;
	token_limit?: number;
	request_usage?: number;
	request_limit?: number;
}

export interface LLMValidationErrorOptions extends LLMErrorOptions {
	validation_type?: string;
	validation_error?: string;
	original_prompt?: string;
	replacement_prompt?: string;
}

export class APIError extends Error {
	public status: ErrorStatus;
	constructor(
		message: string,
		public options?: APIErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.API;
		this.status = options?.status ?? ErrorStatus.InternalServerError;
		this.options = options;
	}
}
export const isAPIError = (value: unknown): value is APIError => {
	return value instanceof APIError;
};

export class LLMError extends Error {
	constructor(
		message: string,
		public options?: LLMErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.LLM;
		this.options = options;
	}
}
export const isLLMError = (value: unknown): value is LLMError => {
	return value instanceof LLMError;
};

export class RateLimitError extends LLMError {
	constructor(
		message: string,
		public options?: LLMRateLimitErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.LLMRateLimit;
	}
}
export const isRateLimitError = (value: unknown): value is RateLimitError => {
	return value instanceof RateLimitError;
};

export class ValidationError extends LLMError {
	constructor(
		message: string,
		public options?: LLMValidationErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.LLMValidation;
	}
}
export const isValidationError = (value: unknown): value is ValidationError => {
	return value instanceof ValidationError;
};
