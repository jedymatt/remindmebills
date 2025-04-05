import { ObjectId } from "mongodb";
import type { BillEvent } from "~/types";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const billRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const billsCursor = ctx.db.collection<BillEvent>("bills").find({
      userId: new ObjectId(ctx.session.user.id),
    });
    const bills = await billsCursor.toArray();
    await billsCursor.close();

    return bills.map((bill) => ({
      ...bill,
      _id: bill._id.toString(),
      userId: bill.userId.toString(),
    }));
  }),
});
