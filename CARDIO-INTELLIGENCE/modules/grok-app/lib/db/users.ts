import { sql } from "./grok_app__lib_db__client";

export type User = {
  id: string;
  phone: string;
  name: string;
  role: string;
  created_at: string;
};

export const users = {
  upsert: async (phone: string, name: string): Promise<User> => {
    const rows = await sql`
      INSERT INTO users (phone, name)
      VALUES (${phone}, ${name})
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, phone, name, role, created_at
    `;
    return rows[0] as User;
  },

  findByPhone: async (phone: string): Promise<User | null> => {
    const rows = await sql`
      SELECT id, phone, name, role, created_at
      FROM users
      WHERE phone = ${phone}
    `;
    return (rows[0] as User) ?? null;
  },

  findById: async (id: string): Promise<User | null> => {
    const rows = await sql`
      SELECT id, phone, name, role, created_at
      FROM users
      WHERE id = ${id}
    `;
    return (rows[0] as User) ?? null;
  },
};
