import { z } from "zod";

const LocalScriptMergeSchema = z.object({
	before: z.array(z.string()).optional(),
	after: z.array(z.string()).optional(),
});

export const SetupConfigSchema = z.object({
	setup: z.array(z.string()).default([]),
	teardown: z.array(z.string()).default([]),
	run: z.array(z.string()).default([]),
});

export const LocalSetupConfigSchema = z.object({
	setup: z.union([z.array(z.string()), LocalScriptMergeSchema]).optional(),
	teardown: z.union([z.array(z.string()), LocalScriptMergeSchema]).optional(),
	run: z.union([z.array(z.string()), LocalScriptMergeSchema]).optional(),
});

export type SetupConfig = z.infer<typeof SetupConfigSchema>;
export type LocalSetupConfig = z.infer<typeof LocalSetupConfigSchema>;
export type LocalScriptMerge = z.infer<typeof LocalScriptMergeSchema>;
