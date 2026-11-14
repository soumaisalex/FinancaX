// Verificações de posse: nunca confie em ids vindos do cliente.
const one = async (q) => (await q)[0] || null;

export const owns = {
  account: async (sql, id, uid) =>
    !!(await one(sql`select 1 as x from accounts where id = ${id} and user_id = ${uid} and not archived`)),
  category: async (sql, id, uid) =>
    !!(await one(sql`select 1 as x from categories where id = ${id} and user_id = ${uid}`)),
};

export const getCard = (sql, id, uid) =>
  one(sql`select id, closing_day, due_day from credit_cards where id = ${id} and user_id = ${uid} and not archived`);
