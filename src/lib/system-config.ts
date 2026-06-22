import { db } from '@/lib/db'

// Ensure default system config values exist
export async function ensureSystemDefaults() {
  const defaults = [
    { key: 'security.apiTokenExpiryMinutes', value: '60', description: 'API token expiry in minutes (default 1 hour)' },
    { key: 'security.apiKeyRotationPeriod', value: '90', description: 'Recommended API key rotation period in days' },
    { key: 'security.jwtExpiration', value: '60', description: 'Admin session expiry in minutes' },
  ]

  for (const item of defaults) {
    const existing = await db.systemConfig.findUnique({ where: { key: item.key } })
    if (!existing) {
      await db.systemConfig.create({ data: item })
    }
  }
}

// Get a system config value
export async function getSystemConfig(key: string, fallback: string = ''): Promise<string> {
  try {
    const config = await db.systemConfig.findUnique({ where: { key } })
    return config?.value ?? fallback
  } catch {
    return fallback
  }
}
