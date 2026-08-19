import 'dotenv/config'
import { buildApp } from './app.js'
import { config } from './shared/config.js'

async function main(): Promise<void> {
  const app = await buildApp()

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()