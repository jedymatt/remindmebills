import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import {
  CreateGroupInputSchema,
  DeleteGroupInputSchema,
  ReorderGroupsInputSchema,
  UpdateGroupInputSchema,
} from "~/schemas/group";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// DB representation — ObjectId fields. See ~/types `Group` for the domain shape.
type GroupDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  order: number;
};

export const groupRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const cursor = ctx.db
      .collection<GroupDoc>("groups")
      .find({ userId: new ObjectId(ctx.session.user.id) })
      .sort({ order: 1 });
    const groups = await cursor.toArray();
    await cursor.close();

    return groups.map((g) => ({
      _id: g._id.toHexString(),
      userId: g.userId.toHexString(),
      name: g.name,
      order: g.order,
    }));
  }),

  create: protectedProcedure
    .input(CreateGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = new ObjectId(ctx.session.user.id);

      const last = await ctx.db
        .collection<GroupDoc>("groups")
        .find({ userId })
        .sort({ order: -1 })
        .limit(1)
        .toArray();
      const nextOrder = last[0] ? last[0].order + 1 : 0;

      const result = await ctx.db
        .collection<WithoutId<GroupDoc>>("groups")
        .insertOne({ userId, name: input.name, order: nextOrder });

      return {
        _id: result.insertedId.toHexString(),
        userId: userId.toHexString(),
        name: input.name,
        order: nextOrder,
      };
    }),

  update: protectedProcedure
    .input(UpdateGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const updateFields: Partial<Pick<GroupDoc, "name">> = {};
      if (input.data.name !== undefined) updateFields.name = input.data.name;

      if (Object.keys(updateFields).length === 0) return;

      const result = await ctx.db
        .collection<GroupDoc>("groups")
        .updateOne(
          {
            _id: new ObjectId(input.id),
            userId: new ObjectId(ctx.session.user.id),
          },
          { $set: updateFields },
        );

      if (result.matchedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }
    }),

  reorder: protectedProcedure
    .input(ReorderGroupsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = new ObjectId(ctx.session.user.id);

      for (const id of input.orderedIds) {
        if (!ObjectId.isValid(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid group id",
          });
        }
      }

      const objectIds = input.orderedIds.map((id) => new ObjectId(id));

      // Validate the input set exactly matches the user's groups.
      const existing = await ctx.db
        .collection<GroupDoc>("groups")
        .find({ userId }, { projection: { _id: 1 } })
        .toArray();

      if (existing.length !== objectIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "orderedIds does not match the user's groups",
        });
      }
      const existingSet = new Set(existing.map((g) => g._id.toHexString()));
      for (const id of input.orderedIds) {
        if (!existingSet.has(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "orderedIds contains an unknown group id",
          });
        }
      }

      const ops = objectIds.map((oid, idx) => ({
        updateOne: {
          filter: { _id: oid, userId },
          update: { $set: { order: idx } },
        },
      }));

      if (ops.length > 0) {
        await ctx.db.collection<GroupDoc>("groups").bulkWrite(ops);
      }
    }),

  delete: protectedProcedure
    .input(DeleteGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const userId = new ObjectId(ctx.session.user.id);
      const groupId = new ObjectId(input.id);

      // Step 1: unset groupId on all bills in this group.
      // Idempotent — safe to retry.
      await ctx.db
        .collection("bills")
        .updateMany({ userId, groupId }, { $unset: { groupId: "" } });

      // Step 2: delete the group itself.
      const result = await ctx.db
        .collection<GroupDoc>("groups")
        .deleteOne({ _id: groupId, userId });

      if (result.deletedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }
    }),
});
