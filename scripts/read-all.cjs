const PAGE = 1000; // PostgREST caps every response at 1000 rows regardless of limit

/** Read every row of a table (select only), checking the count against the server's exact count. */
async function readAll(db, table, columns, order) {
  const { count, error: countError } = await db.from(table).select('*', { count: 'exact', head: true });
  if (countError) throw new Error(`${table}: count failed: ${countError.message}`);
  const rows = [];
  for (let from = 0; from < count; from += PAGE) {
    let query = db.from(table).select(columns);
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: read failed at offset ${from}: ${error.message}`);
    rows.push(...data);
  }
  if (rows.length !== count) throw new Error(`${table}: expected ${count} rows, read ${rows.length}. Catalogue changed mid-read; rerun.`);
  return rows;
}

module.exports = { readAll };
