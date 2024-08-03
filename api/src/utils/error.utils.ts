import {
	APIError,
	ErrorType,
	ErrorTypes,
	FileHandlingError,
	FileNotFoundError,
	FilePatchError,
	FileReadError,
	FileWriteError,
	LLMError,
	RateLimitError,
	ValidationError,
	VectorSearchError,
} from '../errors/error.ts';

export { ErrorType };
import type {
	APIErrorOptions,
	ErrorOptions,
	FileHandlingErrorOptions,
	LLMErrorOptions,
	LLMRateLimitErrorOptions,
	LLMValidationErrorOptions,
	VectorSearchErrorOptions,
} from '../errors/error.ts';

export const createError = (
	errorType: ErrorType,
	message: string,
	options?:
		| ErrorOptions
		| APIErrorOptions
		| LLMErrorOptions
		| LLMRateLimitErrorOptions
		| LLMValidationErrorOptions
		| FileHandlingErrorOptions
		| VectorSearchErrorOptions,
): Error => {
	if (!ErrorTypes.includes(errorType)) {
		throw new Error(`Unknown error type: ${errorType}`);
	}

	switch (errorType) {
		case ErrorType.API:
			return new APIError(message, options as APIErrorOptions);
		case ErrorType.LLM:
			return new LLMError(message, options as LLMErrorOptions);
		case ErrorType.LLMRateLimit:
			return new RateLimitError(message, options as LLMRateLimitErrorOptions);
		case ErrorType.LLMValidation:
			return new ValidationError(message, options as LLMValidationErrorOptions);
		case ErrorType.FileHandling:
			const fileOptions = options as FileHandlingErrorOptions;
			switch (fileOptions.operation) {
				case 'patch':
					return new FilePatchError(message, fileOptions);
				case 'read':
					return fileOptions.filePath
						? new FileNotFoundError(message, fileOptions)
						: new FileReadError(message, fileOptions);
				case 'write':
					return new FileWriteError(message, fileOptions);
				default:
					return new FileHandlingError(message, fileOptions);
			}
		case ErrorType.VectorSearch:
			return new VectorSearchError(message, options as VectorSearchErrorOptions);
		default:
			return new Error(`Unknown error type: ${errorType} - ${message}`);
	}
};

// these `throw...` utilty functions add another layer to the stack trace.
// Best to call `createError` yourself and throw that.

/**
 * Throws APIError with provided message and options
 * @param message
 * @param options
 * @throws Error Throws Error
 */
export const throwAPIError = (
	message: string,
	options?: APIErrorOptions,
): Error => {
	// [TODO] validate options, or at very least set default/required values
	throw createError(ErrorType.API, message, options);
};

/**
 * Throws LLMError with provided message and options
 * @param message
 * @param options
 * @throws Error Throws Error
 */
export const throwLLMError = (
	message: string,
	options?: LLMErrorOptions,
): Error => {
	throw createError(ErrorType.LLM, message, options);
};

/**
 * Throws Error with provided message and options
 * @param errorType: ErrorType
 * @param message: string
 * @param options: ErrorOptions
 * @throws Error Throws Error
 */
export const throwError = (
	errorType: ErrorType,
	message: string,
	options?: ErrorOptions,
): Error => {
	throw createError(errorType, message, options);
};
