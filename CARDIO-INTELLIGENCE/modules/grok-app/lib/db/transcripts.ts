import { sql } from "./grok_app__lib_db__client";

export type Transcript = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export const transcripts = {
  save: async (userId: string, content: string): Promise<Transcript> => {
    const rows = await sql`
      INSERT INTO transcripts (user_id, content)
      VALUES (${userId}, ${content})
      RETURNING id, user_id, content, created_at
    `;
    return rows[0] as Transcript;
  },

  listAll: async (): Promise<Transcript[]> => {
    const rows = await sql`
      SELECT id, user_id, content, created_at
      FROM transcripts
      ORDER BY created_at DESC
    `;
    return rows as Transcript[];
  },

  findById: async (id: string): Promise<Transcript | null> => {
    const rows = await sql`
      SELECT id, user_id, content, created_at
      FROM transcripts
      WHERE id = ${id}
    `;
    return (rows[0] as Transcript) ?? null;
  },
};
