import { z } from "zod";

export const CreateGroupInputSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(50),
});

export const UpdateGroupInputSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().trim().min(1).max(50).optional(),
  }),
});

export const ReorderGroupsInputSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export const DeleteGroupInputSchema = z.object({
  id: z.string(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupInputSchema>;
export type ReorderGroupsInput = z.infer<typeof ReorderGroupsInputSchema>;
export type DeleteGroupInput = z.infer<typeof DeleteGroupInputSchema>;
