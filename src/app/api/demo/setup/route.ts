import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * POST /api/demo/setup
 * 
 * One-click setup for the SelfBase Demo App (Task Manager).
 * Creates:
 *   - `demo_tasks` table with realtime enabled
 *   - `demo_users` table
 *   - `demo_stats` function (returns task statistics)
 *   - An API key for the demo app (sb_live_...)
 * 
 * Returns the API key so the demo frontend can authenticate.
 * 
 * This route requires admin auth (session token).
 */
export async function POST(request: NextRequest) {
  try {
    const results: string[] = []

    // ─── 1. Create demo_tasks table ───────────────────────────────────
    let tasksTable = await db.sbTable.findUnique({ where: { name: 'demo_tasks' } })
    if (!tasksTable) {
      tasksTable = await db.sbTable.create({
        data: {
          name: 'demo_tasks',
          displayName: 'Demo Tasks',
          description: 'Task manager demo — powered by SelfBase',
          priority: 2,
          enableRealtime: true,
          columns: {
            create: [
              { name: 'title', type: 'TEXT', nullable: false, isIndexed: true, order: 0 },
              { name: 'description', type: 'TEXT', order: 1 },
              { name: 'status', type: 'TEXT', isIndexed: true, defaultValue: 'todo', order: 2 },
              { name: 'priority', type: 'TEXT', defaultValue: 'medium', order: 3 },
              { name: 'assignee', type: 'TEXT', isIndexed: true, order: 4 },
              { name: 'dueDate', type: 'TEXT', order: 5 },
              { name: 'tags', type: 'TEXT', order: 6 },
            ],
          },
        },
      })
      results.push('Created demo_tasks table')

      // Seed with sample tasks
      const sampleTasks = [
        { title: 'Design landing page', description: 'Create a modern hero section for the product launch', status: 'in_progress', priority: 'high', assignee: 'Alice', dueDate: '2026-07-01', tags: 'design,urgent' },
        { title: 'Write API documentation', description: 'Document all v1 endpoints with examples', status: 'todo', priority: 'medium', assignee: 'Bob', dueDate: '2026-07-05', tags: 'docs' },
        { title: 'Setup CI/CD pipeline', description: 'Configure GitHub Actions for auto-deploy', status: 'todo', priority: 'high', assignee: 'Charlie', dueDate: '2026-07-03', tags: 'devops' },
        { title: 'Fix login redirect bug', description: 'Users are not redirected after login on Safari', status: 'done', priority: 'high', assignee: 'Alice', dueDate: '2026-06-25', tags: 'bug,urgent' },
        { title: 'Add dark mode support', description: 'Implement theme toggle with localStorage persistence', status: 'in_progress', priority: 'low', assignee: 'Bob', dueDate: '2026-07-10', tags: 'feature' },
      ]
      for (const task of sampleTasks) {
        await db.sbRow.create({
          data: { tableId: tasksTable.id, data: JSON.stringify(task) },
        })
      }
      await db.sbTable.update({
        where: { id: tasksTable.id },
        data: { rowCount: sampleTasks.length, versionHash: randomUUID().substring(0, 16) },
      })
      results.push(`Seeded ${sampleTasks.length} sample tasks`)
    } else {
      results.push('demo_tasks table already exists')
    }

    // ─── 2. Create demo_users table ───────────────────────────────────
    let usersTable = await db.sbTable.findUnique({ where: { name: 'demo_users' } })
    if (!usersTable) {
      usersTable = await db.sbTable.create({
        data: {
          name: 'demo_users',
          displayName: 'Demo Users',
          description: 'Team members for the task manager demo',
          priority: 2,
          enableRealtime: true,
          columns: {
            create: [
              { name: 'name', type: 'TEXT', nullable: false, order: 0 },
              { name: 'email', type: 'TEXT', isUnique: true, order: 1 },
              { name: 'role', type: 'TEXT', defaultValue: 'member', order: 2 },
              { name: 'avatar', type: 'TEXT', order: 3 },
              { name: 'color', type: 'TEXT', order: 4 },
            ],
          },
        },
      })
      results.push('Created demo_users table')

      const sampleUsers = [
        { name: 'Alice Chen', email: 'alice@demo.app', role: 'admin', avatar: 'AC', color: '#f43f5e' },
        { name: 'Bob Smith', email: 'bob@demo.app', role: 'member', avatar: 'BS', color: '#3b82f6' },
        { name: 'Charlie Park', email: 'charlie@demo.app', role: 'member', avatar: 'CP', color: '#10b981' },
      ]
      for (const user of sampleUsers) {
        await db.sbRow.create({
          data: { tableId: usersTable.id, data: JSON.stringify(user) },
        })
      }
      await db.sbTable.update({
        where: { id: usersTable.id },
        data: { rowCount: sampleUsers.length, versionHash: randomUUID().substring(0, 16) },
      })
      results.push(`Seeded ${sampleUsers.length} sample users`)
    } else {
      results.push('demo_users table already exists')
    }

    // ─── 3. Create demo_stats function ────────────────────────────────
    let statsFunc = await db.sbFunction.findUnique({ where: { name: 'demo_stats' } })
    if (!statsFunc) {
      statsFunc = await db.sbFunction.create({
        data: {
          name: 'demo_stats',
          description: 'Returns task statistics for the demo dashboard',
          code: `function handler(input, env) {
  // Calculate stats from the input tasks array
  const tasks = Array.isArray(input) ? input : (input.tasks || []);
  const total = tasks.length;
  const byStatus = { todo: 0, in_progress: 0, done: 0 };
  const byPriority = { low: 0, medium: 0, high: 0 };
  
  for (const t of tasks) {
    const s = t.status || 'todo';
    const p = t.priority || 'medium';
    if (byStatus[s] !== undefined) byStatus[s]++;
    if (byPriority[p] !== undefined) byPriority[p]++;
  }
  
  const completionRate = total > 0 ? Math.round((byStatus.done / total) * 100) : 0;
  
  return {
    total,
    byStatus,
    byPriority,
    completionRate,
    overdue: tasks.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()).length,
  };
}`,
          triggerType: 'http',
          isActive: true,
          timeoutMs: 10000,
        },
      })
      results.push('Created demo_stats function')
    } else {
      results.push('demo_stats function already exists')
    }

    // ─── 4. Create or find the admin user ─────────────────────────────
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    if (!adminUser) {
      return NextResponse.json({ error: 'No admin user found. Please set up your account first.' }, { status: 400 })
    }

    // ─── 5. Create or find demo API key ───────────────────────────────
    let apiKey = await db.apiKey.findFirst({
      where: { name: 'SelfBase Demo App', isActive: true, userId: adminUser.id },
    })

    if (!apiKey) {
      const rawKey = `sb_live_${randomUUID().replace(/-/g, '')}`
      const prefix = rawKey.substring(0, 12)
      apiKey = await db.apiKey.create({
        data: {
          userId: adminUser.id,
          name: 'SelfBase Demo App',
          keyHash: rawKey,
          prefix,
          keyPlain: rawKey,
          permissions: 'read,write,admin',
          isActive: true,
        },
      })
      results.push('Created demo API key')
    } else {
      // Return the existing key (keyPlain is stored for demo convenience)
      results.push('Demo API key already exists')
    }

    return NextResponse.json({
      success: true,
      apiKey: apiKey.keyPlain,
      tables: {
        tasks: 'demo_tasks',
        users: 'demo_users',
      },
      function: 'demo_stats',
      results,
    })
  } catch (err) {
    console.error('[Demo Setup Error]', err)
    return NextResponse.json(
      { error: 'Demo setup failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/demo/status
 * Returns whether the demo is set up and ready
 */
export async function GET() {
  try {
    const tasksTable = await db.sbTable.findUnique({ where: { name: 'demo_tasks' } })
    const usersTable = await db.sbTable.findUnique({ where: { name: 'demo_users' } })
    const statsFunc = await db.sbFunction.findUnique({ where: { name: 'demo_stats' } })
    const apiKey = await db.apiKey.findFirst({
      where: { name: 'SelfBase Demo App', isActive: true },
    })

    return NextResponse.json({
      ready: !!(tasksTable && usersTable && statsFunc && apiKey),
      hasApiKey: !!apiKey,
      tables: {
        tasks: !!tasksTable,
        users: !!usersTable,
      },
      function: !!statsFunc,
    })
  } catch {
    return NextResponse.json({ ready: false })
  }
}
