import 'dotenv/config'

const config = {
  migrationsDir: 'migrations',
  databaseUrl: process.env.DATABASE_URL,
}

export default config