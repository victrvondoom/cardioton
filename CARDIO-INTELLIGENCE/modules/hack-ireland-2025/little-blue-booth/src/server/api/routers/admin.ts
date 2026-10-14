import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * If you want to enforce an `isAdmin` check, add a small middleware or inline
 * check below. E.g. if your `User` table had an `isAdmin` boolean field, do:
 *
 *   if (!ctx.session.user.isAdmin) {
 *     throw new TRPCError({ code: "UNAUTHORIZED" });
 *   }
 *
 * For simplicity, we skip that and just show `protectedProcedure`, which ensures
 * the user is logged in. Customize as needed.
 */

export const adminRouter = createTRPCRouter({
  // Example: fetch all users
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    const client = await clerkClient();
    const currentUser = await client.users.getUser(ctx.session.userId);
    if (currentUser.publicMetadata.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const users = await client.users.getUserList({ orderBy: "-created_at" });
    return users.data.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      createdAt: user.createdAt,
    }));
  }),

  // Example: fetch all conversations
  getAllConversations: protectedProcedure.query(async ({ ctx }) => {
    const client = await clerkClient();
    const currentUser = await client.users.getUser(ctx.session.userId);
    if (currentUser.publicMetadata.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return ctx.db.conversation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        // You can expand to show related chat messages, session, etc.
        chatMessages: true,
        session: true,
      },
    });
  }),

  // Example: fetch a single user by ID
  getUserById: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await clerkClient();
      const currentUser = await client.users.getUser(ctx.session.userId);
      if (currentUser.publicMetadata.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const user = await client.users.getUser(input.userId);
      const sessions = await ctx.db.session.findMany({ where: { userId: input.userId } });
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        createdAt: user.createdAt,
        sessions,
      };
    }),

  // Add more queries (and/or mutations) for the various data models
});
