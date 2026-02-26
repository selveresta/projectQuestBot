import { z } from "zod";

export const WebhookUpdateSchema = z
	.object({
		update_id: z.number().int().nonnegative(),
	})
	.passthrough();

export type WebhookUpdateDto = z.infer<typeof WebhookUpdateSchema>;
