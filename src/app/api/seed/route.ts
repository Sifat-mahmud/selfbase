import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Seed the database with demo data
export async function POST(request: NextRequest) {
  try {
    const results: string[] = []

    // Create demo tables if they don't exist
    const existingTables = await db.sbTable.findMany()
    
    if (existingTables.length === 0) {
      const stocksTable = await db.sbTable.create({
        data: {
          name: 'stocks',
          displayName: 'Stock Prices',
          description: 'Real-time stock market data',
          priority: 1,
          versionHash: 'a1b2c3d4',
          rowCount: 12400,
          enableRealtime: true,
          enableEmbedding: true,
          embeddingColumns: '["symbol","name"]',
          columns: {
            create: [
              { name: 'symbol', type: 'TEXT', isPrimaryKey: true, isUnique: true, isIndexed: true, order: 0 },
              { name: 'name', type: 'TEXT', isIndexed: true, order: 1 },
              { name: 'price', type: 'DECIMAL', order: 2 },
              { name: 'change_pct', type: 'DECIMAL', order: 3 },
              { name: 'volume', type: 'INTEGER', order: 4 },
              { name: 'market_cap', type: 'DECIMAL', order: 5 },
              { name: 'fetched_at', type: 'TIMESTAMP', order: 6 },
            ]
          }
        }
      })
      results.push(`Created table: ${stocksTable.name}`)

      const articlesTable = await db.sbTable.create({
        data: {
          name: 'articles',
          displayName: 'Articles',
          description: 'News articles from RSS feeds',
          priority: 2,
          versionHash: 'e5f6g7h8',
          rowCount: 8750,
          enableRealtime: true,
          enableEmbedding: true,
          embeddingColumns: '["title","content"]',
          columns: {
            create: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, order: 0 },
              { name: 'title', type: 'TEXT', isIndexed: true, order: 1 },
              { name: 'content', type: 'TEXT', order: 2 },
              { name: 'source', type: 'TEXT', order: 3 },
              { name: 'published_at', type: 'TIMESTAMP', isIndexed: true, order: 4 },
              { name: 'url', type: 'TEXT', order: 5 },
            ]
          }
        }
      })
      results.push(`Created table: ${articlesTable.name}`)

      const usersTable = await db.sbTable.create({
        data: {
          name: 'users',
          displayName: 'Users',
          description: 'Application users',
          priority: 1,
          versionHash: 'i9j0k1l2',
          rowCount: 3250,
          rlsEnabled: true,
          columns: {
            create: [
              { name: 'id', type: 'TEXT', isPrimaryKey: true, order: 0 },
              { name: 'email', type: 'TEXT', isUnique: true, isIndexed: true, order: 1 },
              { name: 'name', type: 'TEXT', order: 2 },
              { name: 'role', type: 'TEXT', defaultValue: '"user"', order: 3 },
              { name: 'created_at', type: 'TIMESTAMP', order: 4 },
            ]
          }
        }
      })
      results.push(`Created table: ${usersTable.name}`)

      const ordersTable = await db.sbTable.create({
        data: {
          name: 'orders',
          displayName: 'Orders',
          description: 'Customer orders with priority tracking',
          priority: 2,
          versionHash: 'm3n4o5p6',
          rowCount: 45600,
          enableRealtime: true,
          columns: {
            create: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, order: 0 },
              { name: 'user_id', type: 'TEXT', isIndexed: true, order: 1 },
              { name: 'total', type: 'DECIMAL', order: 2 },
              { name: 'status', type: 'TEXT', isIndexed: true, order: 3 },
              { name: 'created_at', type: 'TIMESTAMP', isIndexed: true, order: 4 },
              { name: 'updated_at', type: 'TIMESTAMP', order: 5 },
            ]
          }
        }
      })
      results.push(`Created table: ${ordersTable.name}`)

      const logsTable = await db.sbTable.create({
        data: {
          name: 'app_logs',
          displayName: 'Application Logs',
          description: 'Application error and info logs',
          priority: 4,
          versionHash: 'q7r8s9t0',
          rowCount: 156000,
          isSystem: true,
          columns: {
            create: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, order: 0 },
              { name: 'level', type: 'TEXT', isIndexed: true, order: 1 },
              { name: 'message', type: 'TEXT', order: 2 },
              { name: 'metadata', type: 'JSON', order: 3 },
              { name: 'timestamp', type: 'TIMESTAMP', isIndexed: true, order: 4 },
            ]
          }
        }
      })
      results.push(`Created table: ${logsTable.name}`)
    }

    // Create demo pipeline sources
    const existingPipelines = await db.pipelineSource.findMany()
    if (existingPipelines.length === 0) {
      await db.pipelineSource.createMany({
        data: [
          {
            name: 'Market Data Feed',
            description: 'Real-time stock prices from Alpha Vantage',
            sourceType: 'rest',
            url: 'https://www.alphavantage.co/query',
            method: 'GET',
            jsonPath: '$.data.stocks',
            fetchInterval: 60,
            isActive: true,
            onConflict: 'update',
            columnMappings: JSON.stringify([
              { src: 'trading_code', target: 'symbol', type: 'TEXT' },
              { src: 'last_trade_price', target: 'price', type: 'DECIMAL' },
              { src: 'change_percent', target: 'change_pct', type: 'DECIMAL' },
              { src: 'volume', target: 'volume', type: 'INTEGER' },
              { src: '__auto__', target: 'fetched_at', type: 'TIMESTAMP' },
            ]),
          },
          {
            name: 'News RSS Feed',
            description: 'Tech news from multiple RSS sources',
            sourceType: 'rss',
            url: 'https://hnrss.org/newest',
            fetchInterval: 300,
            isActive: true,
            onConflict: 'insert',
            columnMappings: JSON.stringify([
              { src: 'title', target: 'title', type: 'TEXT' },
              { src: 'description', target: 'content', type: 'TEXT' },
              { src: 'link', target: 'url', type: 'TEXT' },
              { src: 'pubDate', target: 'published_at', type: 'TIMESTAMP' },
            ]),
          },
          {
            name: 'Weather API',
            description: 'Current weather data for major cities',
            sourceType: 'rest',
            url: 'https://api.openweathermap.org/data/2.5/group',
            method: 'GET',
            fetchInterval: 600,
            isActive: false,
            onConflict: 'replace',
            columnMappings: JSON.stringify([
              { src: 'name', target: 'city', type: 'TEXT' },
              { src: 'main.temp', target: 'temperature', type: 'DECIMAL' },
              { src: 'weather[0].description', target: 'conditions', type: 'TEXT' },
            ]),
          },
          {
            name: 'Crypto WebSocket',
            description: 'Live cryptocurrency prices',
            sourceType: 'websocket',
            url: 'wss://stream.binance.com:9443/ws/btcusdt',
            fetchInterval: 1,
            isActive: true,
            onConflict: 'update',
            columnMappings: JSON.stringify([
              { src: 's', target: 'symbol', type: 'TEXT' },
              { src: 'c', target: 'price', type: 'DECIMAL' },
              { src: 'v', target: 'volume', type: 'DECIMAL' },
            ]),
          },
        ]
      })
      results.push('Created 4 pipeline sources')
    }

    // Create demo scraper sitemaps
    const existingScrapers = await db.scraperSitemap.findMany()
    if (existingScrapers.length === 0) {
      await db.scraperSitemap.createMany({
        data: [
          {
            name: 'E-commerce Products',
            startUrl: 'https://example-shop.com/products',
            selectorTree: JSON.stringify({
              id: 'product', type: 'Element', selector: '.product', multiple: true,
              children: [
                { id: 'name', type: 'Text', selector: '.title' },
                { id: 'price', type: 'Text', selector: '.price' },
                { id: 'image', type: 'Attribute', selector: 'img', attribute: 'src' },
              ]
            }),
            paginationType: 'click',
            paginationConfig: JSON.stringify({ nextSelector: '.next-page', maxPages: 10 }),
            fetchInterval: 3600,
            isActive: true,
          },
          {
            name: 'Blog Posts',
            startUrl: 'https://example-blog.com/posts',
            selectorTree: JSON.stringify({
              id: 'post', type: 'Element', selector: 'article.post', multiple: true,
              children: [
                { id: 'title', type: 'Text', selector: 'h2' },
                { id: 'excerpt', type: 'Text', selector: '.excerpt' },
                { id: 'author', type: 'Text', selector: '.author-name' },
                { id: 'date', type: 'Text', selector: 'time' },
              ]
            }),
            paginationType: 'url_pattern',
            paginationConfig: JSON.stringify({ pattern: '?page={1..20}' }),
            fetchInterval: 7200,
            isActive: false,
          },
        ]
      })
      results.push('Created 2 scraper sitemaps')
    }

    // Create demo user
    const existingUsers = await db.user.findMany()
    if (existingUsers.length === 0) {
      await db.user.createMany({
        data: [
          { email: 'admin@selfbase.dev', name: 'Admin', role: 'admin', passwordHash: 'hashed_admin_pass' },
          { email: 'dev@selfbase.dev', name: 'Developer', role: 'user', passwordHash: 'hashed_dev_pass' },
          { email: 'viewer@selfbase.dev', name: 'Viewer', role: 'user', passwordHash: 'hashed_viewer_pass', isActive: false },
        ]
      })
      results.push('Created 3 demo users')
    }

    // Create demo API keys
    const existingKeys = await db.apiKey.findMany()
    if (existingKeys.length === 0) {
      const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
      if (adminUser) {
        await db.apiKey.createMany({
          data: [
            { userId: adminUser.id, name: 'Production Key', keyHash: 'sb_prod_xxxxxxxxxxxx', prefix: 'sb_prod', permissions: 'read,write', isActive: true },
            { userId: adminUser.id, name: 'Development Key', keyHash: 'sb_dev_xxxxxxxxxxxx', prefix: 'sb_dev', permissions: 'read', isActive: true },
            { userId: adminUser.id, name: 'Legacy Key (Revoked)', keyHash: 'sb_old_xxxxxxxxxxxx', prefix: 'sb_old', permissions: 'read', isActive: false },
          ]
        })
        results.push('Created 3 API keys')
      }
    }

    // Create demo functions
    const existingFunctions = await db.sbFunction.findMany()
    if (existingFunctions.length === 0) {
      await db.sbFunction.createMany({
        data: [
          {
            name: 'emailWorker',
            description: 'Process email notifications for order events',
            code: `export default async function(ctx) {
  const { table, eventType, row } = ctx.event;
  if (eventType === 'insert' && table === 'orders') {
    const user = await ctx.db.query('SELECT email FROM users WHERE id = $1', [row.user_id]);
    await sendEmail(user.email, 'Order Confirmed', 'Your order #' + row.id + ' has been received.');
  }
}`,
            runtime: 'javascript',
            triggerType: 'event',
            triggerConfig: JSON.stringify({ table: 'orders', events: ['insert'] }),
            isActive: true,
          },
          {
            name: 'webhookHandler',
            description: 'Handle incoming webhooks from payment provider',
            code: `export default async function(ctx) {
  const sig = ctx.headers['x-signature'];
  if (!verifySignature(ctx.body, sig)) {
    return { status: 401, body: 'Invalid signature' };
  }
  const event = JSON.parse(ctx.body);
  await ctx.db.query('UPDATE orders SET status = $1 WHERE id = $2', [event.status, event.order_id]);
  return { status: 200, body: 'OK' };
}`,
            runtime: 'javascript',
            triggerType: 'http',
            isActive: true,
          },
          {
            name: 'dailyReport',
            description: 'Generate daily analytics report',
            code: `export default async function(ctx) {
  const stats = await ctx.db.query(\`
    SELECT COUNT(*) as total_orders, SUM(total) as revenue 
    FROM orders WHERE created_at >= CURRENT_DATE
  \`);
  await sendReport('daily', stats);
  return { status: 200, body: stats };
}`,
            runtime: 'javascript',
            triggerType: 'schedule',
            triggerConfig: JSON.stringify({ cron: '0 9 * * *' }),
            isActive: false,
          },
        ]
      })
      results.push('Created 3 serverless functions')
    }

    // Create demo heartbeat data
    const existingHeartbeats = await db.heartbeat.findMany()
    if (existingHeartbeats.length === 0) {
      const now = Date.now()
      const heartbeatData = []
      for (let i = 60; i >= 0; i--) {
        const recordedAt = new Date(now - i * 60000)
        const cpuBase = 15 + Math.random() * 30
        heartbeatData.push({
          recordedAt,
          cpuTotal: Math.round(cpuBase),
          cpuScraper: Math.round(cpuBase * 0.25),
          cpuApi: Math.round(cpuBase * 0.5),
          cpuFunctions: Math.round(cpuBase * 0.25),
          ramUsedMb: Math.round(350 + Math.random() * 200),
          diskUsedMb: Math.round(1800 + Math.random() * 400),
          activeConnections: Math.round(8 + Math.random() * 30),
          reqPerSec: Math.round(50 + Math.random() * 200),
          intervalSec: 60,
          loadScore: Math.round(cpuBase * 0.8 + Math.random() * 15),
        })
      }
      await db.heartbeat.createMany({ data: heartbeatData })
      results.push(`Created ${heartbeatData.length} heartbeat records`)
    }

    // Create demo table call metrics
    const existingCalls = await db.tableCall.findMany()
    if (existingCalls.length === 0) {
      const now = Date.now()
      const tables = ['stocks', 'articles', 'users', 'orders', 'app_logs']
      const callData = []
      for (let i = 30; i >= 0; i--) {
        for (const table of tables) {
          callData.push({
            windowStart: new Date(now - i * 60000),
            tableName: table,
            callCount: Math.round(10 + Math.random() * 100),
            avgLatencyMs: Math.round(5 + Math.random() * 50),
            maxLatencyMs: Math.round(50 + Math.random() * 200),
            errorCount: Math.round(Math.random() * 5),
          })
        }
      }
      await db.tableCall.createMany({ data: callData })
      results.push(`Created ${callData.length} table call records`)
    }

    // Create demo LLM configs
    const existingLlm = await db.llmConfig.findMany()
    if (existingLlm.length === 0) {
      await db.llmConfig.createMany({
        data: [
          {
            provider: 'openai',
            name: 'GPT-4o',
            modelName: 'gpt-4o',
            isActive: true,
            maxTokens: 4096,
            temperature: 0.7,
            costPer1kInput: 0.005,
            costPer1kOutput: 0.015,
          },
          {
            provider: 'anthropic',
            name: 'Claude Sonnet',
            modelName: 'claude-3-sonnet',
            isActive: true,
            maxTokens: 4096,
            temperature: 0.5,
            costPer1kInput: 0.003,
            costPer1kOutput: 0.015,
          },
          {
            provider: 'ollama',
            name: 'Llama 3 Local',
            baseUrl: 'http://localhost:11434',
            modelName: 'llama3',
            isActive: false,
            maxTokens: 2048,
            temperature: 0.8,
          },
          {
            provider: 'custom',
            name: 'Fine-tuned Model',
            baseUrl: 'https://api.custom-llm.com/v1',
            modelName: 'custom-v2',
            isActive: false,
            maxTokens: 2048,
            temperature: 0.3,
          },
        ]
      })
      results.push('Created 4 LLM provider configs')
    }

    // Create demo storage files
    const existingFiles = await db.storageFile.findMany()
    if (existingFiles.length === 0) {
      await db.storageFile.createMany({
        data: [
          { name: 'report-q1.pdf', originalName: 'Q1 Report.pdf', path: '/storage/reports/report-q1.pdf', bucket: 'reports', mimeType: 'application/pdf', sizeBytes: 2450000, isPublic: false },
          { name: 'logo.svg', originalName: 'Company Logo.svg', path: '/storage/assets/logo.svg', bucket: 'assets', mimeType: 'image/svg+xml', sizeBytes: 12400, isPublic: true },
          { name: 'export-users.csv', originalName: 'users-export.csv', path: '/storage/exports/export-users.csv', bucket: 'exports', mimeType: 'text/csv', sizeBytes: 890000, isPublic: false },
          { name: 'backup-2024-01.sql', originalName: 'backup-jan.sql', path: '/storage/backups/backup-2024-01.sql', bucket: 'backups', mimeType: 'application/sql', sizeBytes: 15600000, isPublic: false },
          { name: 'hero-banner.jpg', originalName: 'Hero Banner.jpg', path: '/storage/assets/hero-banner.jpg', bucket: 'assets', mimeType: 'image/jpeg', sizeBytes: 3400000, isPublic: true },
        ]
      })
      results.push('Created 5 storage files')
    }

    // Create demo alert configs
    const existingAlerts = await db.alertConfig.findMany()
    if (existingAlerts.length === 0) {
      await db.alertConfig.createMany({
        data: [
          { metricType: 'cpu', threshold: 80, operator: '>', duration: 300, webhookUrl: 'https://hooks.slack.com/services/xxx', isEnabled: true },
          { metricType: 'req_per_sec', threshold: 1000, operator: '>', duration: 60, isEnabled: true },
          { metricType: 'error_rate', threshold: 5, operator: '>', duration: 120, emailTo: 'admin@selfbase.dev', isEnabled: true },
          { metricType: 'disk', threshold: 90, operator: '>', duration: 600, isEnabled: false },
        ]
      })
      results.push('Created 4 alert configs')
    }

    // Create demo pipeline runs
    const existingRuns = await db.pipelineRun.findMany()
    if (existingRuns.length === 0) {
      const sources = await db.pipelineSource.findMany()
      if (sources.length > 0) {
        const runData = []
        const now = Date.now()
        for (const source of sources) {
          for (let i = 10; i >= 0; i--) {
            const startedAt = new Date(now - i * source.fetchInterval * 1000)
            const status = Math.random() > 0.1 ? 'success' : 'failed'
            const duration = Math.round(200 + Math.random() * 3000)
            const rowsFetched = status === 'success' ? Math.round(50 + Math.random() * 2000) : 0
            runData.push({
              sourceId: source.id,
              status,
              startedAt,
              completedAt: status === 'success' ? new Date(startedAt.getTime() + duration) : null,
              durationMs: status === 'success' ? duration : null,
              rowsFetched,
              rowsWritten: status === 'success' ? Math.round(rowsFetched * 0.95) : 0,
              rowsFailed: status === 'success' ? Math.round(rowsFetched * 0.05) : rowsFetched,
              errorPayload: status === 'failed' ? JSON.stringify({ error: 'Connection timeout' }) : null,
            })
          }
        }
        await db.pipelineRun.createMany({ data: runData })
        results.push(`Created ${runData.length} pipeline run records`)
      }
    }

    return NextResponse.json({
      success: true,
      data: { seeded: results },
      message: 'Demo data seeded successfully'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
