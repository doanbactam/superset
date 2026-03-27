import {
	AGENT_LABELS,
	AGENT_PRESET_COMMANDS,
	AGENT_PRESET_DESCRIPTIONS,
	AGENT_PROMPT_COMMANDS,
	AGENT_TYPES,
	type AgentType,
} from "./agent-command";
import {
	DEFAULT_CHAT_TASK_PROMPT_TEMPLATE,
	DEFAULT_TERMINAL_TASK_PROMPT_TEMPLATE,
} from "./agent-prompt-template";
import { listAgentTypes, type AgentFactory } from "./agent-registry";

export const BUILTIN_AGENT_IDS = [...AGENT_TYPES, "superset-chat"] as const;

export type BuiltinAgentId = (typeof BUILTIN_AGENT_IDS)[number];
export type AgentDefinitionId = BuiltinAgentId | `custom:${string}`;
export type AgentDefinitionSource = "builtin" | "user";
export type AgentKind = "terminal" | "chat";

interface BaseAgentDefinition {
	id: AgentDefinitionId;
	source: AgentDefinitionSource;
	kind: AgentKind;
	defaultLabel: string;
	defaultDescription?: string;
	defaultEnabled: boolean;
}

export interface TerminalAgentDefinition extends BaseAgentDefinition {
	kind: "terminal";
	defaultCommand: string;
	defaultPromptCommand: string;
	defaultPromptCommandSuffix?: string;
	defaultTaskPromptTemplate: string;
}

export interface ChatAgentDefinition extends BaseAgentDefinition {
	kind: "chat";
	defaultTaskPromptTemplate: string;
	defaultModel?: string;
}

export type AgentDefinition = TerminalAgentDefinition | ChatAgentDefinition;

export const BUILTIN_AGENT_LABELS: Record<BuiltinAgentId, string> = {
	...AGENT_LABELS,
	"superset-chat": "Superset Chat",
};

function createBuiltinTerminalAgentDefinition(
	id: AgentType,
): TerminalAgentDefinition {
	const promptCommand = AGENT_PROMPT_COMMANDS[id];

	return {
		id,
		source: "builtin",
		kind: "terminal",
		defaultLabel: AGENT_LABELS[id],
		defaultDescription: AGENT_PRESET_DESCRIPTIONS[id],
		defaultCommand: AGENT_PRESET_COMMANDS[id][0] ?? "",
		defaultPromptCommand: promptCommand.command,
		defaultPromptCommandSuffix: promptCommand.suffix,
		defaultTaskPromptTemplate: DEFAULT_TERMINAL_TASK_PROMPT_TEMPLATE,
		defaultEnabled: true,
	};
}

export const BUILTIN_AGENT_DEFINITIONS: AgentDefinition[] = [
	...AGENT_TYPES.map((id) => createBuiltinTerminalAgentDefinition(id)),
	{
		id: "superset-chat",
		source: "builtin",
		kind: "chat",
		defaultLabel: BUILTIN_AGENT_LABELS["superset-chat"],
		defaultDescription:
			"Superset's built-in workspace chat for project-aware help and task launches.",
		defaultTaskPromptTemplate: DEFAULT_CHAT_TASK_PROMPT_TEMPLATE,
		defaultEnabled: true,
	},
];

export function getBuiltinAgentDefinition(id: BuiltinAgentId): AgentDefinition {
	const definition = BUILTIN_AGENT_DEFINITIONS.find((item) => item.id === id);
	if (!definition) {
		throw new Error(`Unknown built-in agent definition: ${id}`);
	}
	return definition;
}

export function isTerminalAgentDefinition(
	definition: AgentDefinition,
): definition is TerminalAgentDefinition {
	return definition.kind === "terminal";
}

export function isChatAgentDefinition(
	definition: AgentDefinition,
): definition is ChatAgentDefinition {
	return definition.kind === "chat";
}

export function isBuiltinAgentId(id: string): id is BuiltinAgentId {
	return (BUILTIN_AGENT_IDS as readonly string[]).includes(id);
}

export function isCustomAgentId(id: string): id is `custom:${string}` {
	return id.startsWith("custom:");
}

/**
 * Get all agent definitions including runtime-registered agents from the registry.
 * Use this instead of BUILTIN_AGENT_DEFINITIONS when you want custom agents added via registerAgentType().
 */
export function getAllAgentDefinitions(): AgentDefinition[] {
	const builtin = [...BUILTIN_AGENT_DEFINITIONS];
	const registryAgents = listAgentTypes();

	for (const factory of registryAgents) {
		if (!BUILTIN_AGENT_IDS.includes(factory.id as BuiltinAgentId)) {
			builtin.push({
				id: factory.id as AgentDefinitionId,
				source: "builtin",
				kind: "terminal",
				defaultLabel: factory.label,
				defaultDescription: factory.description,
				defaultCommand: factory.createCommand({} as AgentCommand).join(" "),
				defaultPromptCommand: factory.createCommand({} as AgentCommand).join(" "),
				defaultTaskPromptTemplate: DEFAULT_TERMINAL_TASK_PROMPT_TEMPLATE,
				defaultEnabled: true,
			});
		}
	}

	return builtin;
}
