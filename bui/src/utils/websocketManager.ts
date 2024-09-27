import { Signal, signal } from '@preact/signals';
import { ConversationEntry } from 'shared/types.ts';

class WebSocketManager {
	private socket: WebSocket | null = null;
	private apiHostname: string;
	private apiPort: number;
	private apiUseTls: boolean;
	private conversationId: string | null = null;
	private startDir: string;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;

	//private conversationEntriesSignal = signal<ConversationEntry[]>([]);
	//private subscribers: ((messages: ConversationEntry[]) => void)[] = [];
	private conversationEntriesSignal = signal<ConversationEntry>({} as ConversationEntry);
	private subscribers: ((message: ConversationEntry) => void)[] = [];
	public isConnected = signal<boolean>(false);
	public isReady = signal<boolean>(false);
	public error = signal<string | null>(null);

	constructor(apiHostname: string, apiPort: number, apiUseTls: boolean, startDir: string) {
		this.apiHostname = apiHostname;
		this.apiPort = apiPort;
		this.apiUseTls = apiUseTls;
		this.startDir = startDir;
	}

	setConversationId(id: string) {
		this.conversationId = id;
	}

	setStartDir(dir: string) {
		this.startDir = dir;
	}
	updateConversation(id: string) {
		this.setConversationId(id);
		if (this.socket) {
			this.socket.close();
		}
		this.connect();
	}

	connect() {
		if (!this.conversationId) {
			this.error.value = 'No conversation ID set';
			return;
		}

		this.socket = new WebSocket(
			`${
				this.apiUseTls
					? 'wss'
					: 'ws'
			}://${this.apiHostname}:${this.apiPort}/api/v1/ws/conversation/${this.conversationId}`,
		);

		this.socket.onopen = () => {
			console.log('WebSocket connected');
			this.isConnected.value = true;
			this.error.value = null;
			this.reconnectAttempts = 0;

			// Send greeting message
			this.sendMessage({
				conversationId: this.conversationId!,
				startDir: this.startDir,
				task: 'greeting',
				statement: '',
			});
		};

		this.socket.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			console.log('Received message:', msg);
			if (
				'type' in msg.data || 'answer' in msg.data ||
				'conversationTitle' in msg.data
			) {
				if ('answer' in msg.data || 'logEntry' in msg.data) {
					//this.conversationEntriesSignal.value = [...this.conversationEntriesSignal.value, msg.data as ConversationEntry];
					//this.conversationEntriesSignal.value = [msg.data as ConversationEntry];
					this.conversationEntriesSignal.value = msg.data as ConversationEntry;
				} else if ('conversationTitle' in msg.data) {
					// Handle conversationReady
					this.isReady.value = true;
				}
				this.notifySubscribers();
			}
		};

		this.socket.onclose = () => {
			console.log('WebSocket disconnected');
			this.isConnected.value = false;
			this.reconnect();
		};

		this.socket.onerror = (err) => {
			console.error('WebSocket error:', err);
			this.error.value = 'WebSocket error occurred';
		};
	}

	private reconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.error.value = 'Max reconnection attempts reached. Please refresh the page.';
			return;
		}

		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts) +
			Math.random() * 1000;
		console.log(`Retrying connection in ${delay}ms...`);

		setTimeout(() => {
			this.reconnectAttempts++;
			this.connect();
		}, delay);
	}

	sendMessage(message: any) {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(message));
		} else {
			this.error.value = 'WebSocket is not connected. Please wait or refresh the page.';
		}
	}

	disconnect() {
		if (this.socket) {
			this.socket.close();
		}
	}

	//subscribe(callback: (messages: ConversationEntry[]) => void) {
	subscribe(callback: (message: ConversationEntry) => void) {
		this.subscribers.push(callback);
		return {
			unsubscribe: () => {
				this.subscribers = this.subscribers.filter((cb) => cb !== callback);
			},
		};
	}

	private notifySubscribers() {
		const entries = this.conversationEntriesSignal.value;
		this.subscribers.forEach((callback) => callback(entries));
	}

	//get conversationEntries(): Signal<ConversationEntry[]> {
	get conversationEntries(): Signal<ConversationEntry> {
		return this.conversationEntriesSignal;
	}
}

export const createWebSocketManager = (apiHostname: string, apiPort: number, apiUseTls: boolean, startDir: string) =>
	new WebSocketManager(apiHostname, apiPort, apiUseTls, startDir);
