export interface AgentCommand {
	task?: unknown;
	randomId?: string;
}

export interface AgentFactory {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	createCommand: (opts: AgentCommand) => string[];
}

const registry = new Map<string, AgentFactory>();

export function registerAgentType(factory: AgentFactory): void {
	registry.set(factory.id, factory);
}

export function getAgentType(id: string): AgentFactory | undefined {
	return registry.get(id);
}

export function listAgentTypes(): AgentFactory[] {
	return Array.from(registry.values());
}

export function hasAgentType(id: string): boolean {
	return registry.has(id);
}

// Built-in agents
registerAgentType({
	id: "claude",
	label: "Claude",
	description:
		"Anthropic's coding agent for reading code, editing files, and running terminal workflows.",
	createCommand: () => ["claude --dangerously-skip-permissions"],
});

registerAgentType({
	id: "codex",
	label: "Codex",
	description:
		"OpenAI's coding agent for reading, modifying, and running code across tasks.",
	createCommand: () => [
		'codex -c model_reasoning_effort="high" --dangerously-bypass-approvals-and-sandbox -c model_reasoning_summary="detailed" -c model_supports_reasoning_summaries=true',
	],
});

registerAgentType({
	id: "gemini",
	label: "Gemini",
	description:
		"Google's open-source terminal agent for coding, problem-solving, and task work.",
	createCommand: () => ["gemini --yolo"],
});

registerAgentType({
	id: "mastracode",
	label: "Mastracode",
	description:
		"Mastra's coding agent for building, debugging, and shipping code from the terminal.",
	createCommand: () => ["mastracode"],
});

registerAgentType({
	id: "opencode",
	label: "OpenCode",
	description: "Open-source coding agent for the terminal, IDE, and desktop.",
	createCommand: () => ["opencode"],
});

registerAgentType({
	id: "pi",
	label: "Pi",
	description: "Minimal terminal coding harness for flexible coding workflows.",
	createCommand: () => ["pi"],
});

registerAgentType({
	id: "copilot",
	label: "Copilot",
	description:
		"GitHub's coding agent for planning, editing, and building in your repo.",
	createCommand: () => ["copilot --allow-all"],
});

registerAgentType({
	id: "cursor-agent",
	label: "Cursor Agent",
	description:
		"Cursor's coding agent for editing, running, and debugging code in parallel.",
	createCommand: () => ["cursor-agent"],
});
