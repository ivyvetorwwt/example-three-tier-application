const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GET /tasks — list all tasks
app.get('/tasks', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json(rows);
});

// POST /tasks — create a task
app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const { rows } = await db.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
    [title.trim()]
  );
  res.status(201).json(rows[0]);
});

/**
 * PATCH /tasks/:id — update a task (complete/uncomplete or rename)
 *
 * This route uses a single atomic UPDATE ... RETURNING with COALESCE to avoid
 * the read-then-write race condition that existed in the previous implementation.
 *
 * WHY THIS DESIGN IS SAFER FOR PERFORMANCE ACROSS EVERY REQUEST:
 *
 * 1. ELIMINATES RACE CONDITIONS: The previous implementation performed a SELECT
 *    followed by an UPDATE. Between these two queries, another concurrent request
 *    could modify the same row, causing a "lost update" problem where one client's
 *    changes silently overwrite another's. With a single atomic UPDATE, PostgreSQL
 *    guarantees row-level locking during the update, ensuring serialized access.
 *
 * 2. REDUCES ROUND TRIPS: Instead of 2 database round trips (SELECT + UPDATE),
 *    we now make only 1. This halves network latency overhead and reduces the
 *    window during which the connection is occupied.
 *
 * 3. LOWER LOCK CONTENTION: The previous approach held implicit locks longer
 *    because the application had to process the SELECT result before issuing
 *    the UPDATE. A single statement minimizes the lock duration.
 *
 * 4. CONSISTENT BEHAVIOR UNDER LOAD: Under high concurrency, the old pattern
 *    could produce inconsistent results depending on timing. The atomic approach
 *    guarantees that each request sees and modifies the latest committed state.
 *
 * 5. SIMPLER ERROR HANDLING: With one query, there's no need to handle partial
 *    failures (e.g., SELECT succeeds but UPDATE fails due to concurrent delete).
 *
 * The COALESCE pattern works by using the provided value if non-null, otherwise
 * falling back to the existing column value — all evaluated atomically within
 * the single UPDATE statement.
 */
app.patch('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  const { completed, title } = req.body;

  // Normalize inputs: undefined means "keep existing value" (handled by COALESCE)
  // We pass null to COALESCE when the field wasn't provided in the request body
  const completedParam = completed !== undefined ? Boolean(completed) : null;
  const titleParam = title !== undefined ? title.trim() : null;

  // Single atomic UPDATE with COALESCE to merge provided fields with existing values.
  // COALESCE(x, column) returns x if x is not null, otherwise returns column's current value.
  // This eliminates the race condition between concurrent PATCH requests.
  const { rows } = await db.query(
    `UPDATE tasks
     SET completed = COALESCE($1, completed),
         title = COALESCE($2, title)
     WHERE id = $3
     RETURNING *`,
    [completedParam, titleParam, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(rows[0]);
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
