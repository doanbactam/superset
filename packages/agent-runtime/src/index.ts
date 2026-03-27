// Auth storage interface
export interface Credential {
	type: 'api_key' | 'oauth';
	key?: string;
	access?: string;
	refresh?: string;
	expires?: number;
	accountId?: string;
}

export interface LoginCallbacks {
	onAuth?: (info: OAuthAuthInfo) => void;
	onSuccess?: () => void;
	onError?: (error: Error) => void;
}

export interface OAuthAuthInfo {
	code: string;
	state: string;
}

export interface AuthStorage {
	reload(): void;
	get(providerId: string): Credential | null;
	set(providerId: string, credential: Credential): void;
	remove(providerId: string): void;
	login(providerId: string, callbacks: LoginCallbacks): Promise<void>;
}

// Runtime interfaces (stubs for now - full implementation later)
export interface RuntimeOptions {
	cwd: string;
	extraTools?: unknown[];
	disableMcp?: boolean;
	initialState?: { observerModelId?: string; reflectorModelId?: string };
}

export interface Runtime {
	harness: unknown;
	mcpManager: unknown;
	hookManager: { setSessionId(sessionId: string): void };
}

// Factory functions (stubs that throw "not implemented" for now)
export function createAuthStorage(): AuthStorage {
	throw new Error('not implemented');
}

export async function createMastraCode(_options: RuntimeOptions): Promise<Runtime> {
	throw new Error('not implemented');
}
