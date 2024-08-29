import { useEffect, useRef, useState } from 'preact/hooks';
import { marked } from 'marked';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { createWebSocketManager } from '../utils/websocketManager.ts';
import { ConversationContinue, ConversationEntry, ConversationResponse, ConversationStart } from 'shared/types.ts';
import { useSignal } from '@preact/signals';

interface ChatProps {
	apiPort: number;
}

export default function Chat({ apiPort }: ChatProps) {
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [startDir, setStartDir] = useState('/Users/cng/working/bbai/');
	const [conversationId, setConversationId] = useState<string | null>(null);
	const wsManager = useSignal<ReturnType<typeof createWebSocketManager> | null>(null);
	const conversationEntries = useSignal<ConversationEntry[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (IS_BROWSER && !wsManager.value && apiPort) {
			const newConversationId = generateConversationId();
			setConversationId(newConversationId);

			const manager = createWebSocketManager(apiPort, startDir);
			manager.setConversationId(newConversationId);
			wsManager.value = manager;
			manager.connect();

			return () => {
				manager.disconnect();
			};
		}
	}, [apiPort, startDir]);

	useEffect(() => {
		if (wsManager.value) {
			const subscription = wsManager.value.subscribe((newEntry) => {
				if ('type' in newEntry || 'answer' in newEntry) {
					conversationEntries.value = [...conversationEntries.value, newEntry];
				} else if ('conversationTitle' in newEntry) {
					wsManager.value.isReady.value = true;
				}
			});

			return () => {
				subscription.unsubscribe();
			};
		}
	}, [wsManager.value]);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
		}
	}, [conversationEntries.value]);

	const sendMessage = async () => {
		if (!wsManager.value?.isReady.value) {
			alert('Chat is not ready yet. Please wait for the conversation to start.');
			return;
		}
		setIsLoading(true);
		if (input.trim() && wsManager.value) {
			wsManager.value.sendMessage({
				conversationId,
				startDir,
				task: 'converse',
				statement: input.trim(),
			});
			setInput('');
		}
		setIsLoading(false);
	};

	const handleInputChange = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		setInput(target.value);
		adjustTextareaHeight();
	};

	const adjustTextareaHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	};

	const renderEntry = (entry: ConversationEntry, index: number) => {
		if ('type' in entry) {
			// Handle ConversationContinue
			const bgColor = entry.type === 'user'
				? 'bg-blue-100'
				: entry.type === 'assistant'
				? 'bg-green-100'
				: entry.type === 'tool_use' || entry.type === 'tool_result'
				? 'bg-yellow-100'
				: entry.type === 'auxiliary'
				? 'bg-purple-100'
				: 'bg-red-100';

			return (
				<div
					key={index}
					className={`p-4 rounded-lg mb-4 ${bgColor} shadow-md transition-all duration-300 hover:shadow-lg`}
				>
					<div className='font-semibold mb-2'>{entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</div>
					<div
						className='prose max-w-none'
						dangerouslySetInnerHTML={{ __html: marked(entry.content || '') }}
					/>
					<div className='text-xs text-gray-500 mt-2'>
						{new Date(entry.timestamp).toLocaleString()}
						<br />
						Tokens: {entry.tokenUsageTurn.totalTokens} | Total:{' '}
						{entry.tokenUsageConversation.totalTokensTotal}
					</div>
				</div>
			);
		} else if ('answer' in entry) {
			// Handle ConversationResponse
			return (
				<div
					key={index}
					className='bg-green-100 p-4 rounded-lg mb-4 shadow-md transition-all duration-300 hover:shadow-lg'
				>
					<div className='font-semibold mb-2'>Assistant</div>
					<div
						className='prose max-w-none'
						dangerouslySetInnerHTML={{ __html: marked(entry.answer || '') }}
					/>
					<div className='font-semibold mt-4 mb-2'>Assistant Thinking:</div>
					<div
						className='prose max-w-none'
						dangerouslySetInnerHTML={{ __html: marked(entry.assistantThinking || '') }}
					/>
					<div className='text-xs text-gray-500 mt-2'>
						{new Date(entry.messageMeta.timestamp).toLocaleString()}
						<br />
						Tokens: {entry.tokenUsageStatement.totalTokens} | Total:{' '}
						{entry.tokenUsageConversation.totalTokensTotal}
					</div>
				</div>
			);
		}
	};

	return (
		<div className='flex flex-col h-screen bg-gray-100'>
			<header className='bg-blue-600 text-white p-4 shadow-md'>
				<h1 className='text-2xl font-bold'>BBai Chat Interface</h1>
			</header>
			<main className='flex-grow flex flex-col p-4 space-y-4 overflow-hidden'>
				{wsManager.value?.error.value && (
					<div
						className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative animate-pulse'
						role='alert'
					>
						<strong className='font-bold'>Error:</strong>
						<span className='block sm:inline'>{wsManager.value.error.value}</span>
					</div>
				)}
				<div className='bg-white p-4 rounded-lg shadow-md'>
					<label htmlFor='startDir' className='block text-sm font-medium text-gray-700 mb-2'>
						Project Directory:
					</label>
					<input
						type='text'
						id='startDir'
						value={startDir}
						onChange={(e) => {
							setStartDir(e.currentTarget.value);
							wsManager.value?.setStartDir(e.currentTarget.value);
						}}
						className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300'
						placeholder='Enter project directory path'
					/>
				</div>
				<div className='flex-grow overflow-y-auto bg-white rounded-lg shadow-md p-4' ref={messagesEndRef}>
					{conversationEntries.value.map(renderEntry)}
				</div>
				<div className='bg-white p-4 rounded-lg shadow-md'>
					<div className='flex items-end space-x-2'>
						<textarea
							ref={textareaRef}
							value={input}
							onInput={handleInputChange}
							onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
							className='flex-grow p-2 border rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300'
							placeholder='Type your message... (Shift + Enter for new line)'
							rows={1}
						/>
						<button
							onClick={sendMessage}
							className='bg-blue-500 text-white p-2 rounded-lg transition-all duration-300 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
							disabled={isLoading}
						>
							{isLoading
								? (
									<svg
										className='animate-spin h-5 w-5 text-white'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
									>
										<circle
											className='opacity-25'
											cx='12'
											cy='12'
											r='10'
											stroke='currentColor'
											stroke-width='4'
										>
										</circle>
										<path
											className='opacity-75'
											fill='currentColor'
											d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
										>
										</path>
									</svg>
								)
								: (
									'Send'
								)}
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
