"use server";

import { users } from "@/lib/db/grok_app__lib_db__index";

export async function upsertUser(phone: string, name: string) {
  return users.upsert(phone, name);
}
