import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { pool } from './client.js'

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_USER_ID = '33333333-3333-3333-3333-333333333333'
const BRANCH_ID = '44444444-4444-4444-4444-444444444444'

const CATEGORIES = [
  { id: '22222222-2222-2222-2222-222222222222', name: 'Platos principales', position: 0 },
  { id: '22222222-2222-2222-2222-222222222223', name: 'Bebidas', position: 1 },
  { id: '22222222-2222-2222-2222-222222222224', name: 'Postres', position: 2 },
]

const MENU_ITEMS: Array<{
  categoryId: string
  name: string
  description: string | null
  price: string
}> = [
  { categoryId: CATEGORIES[0]!.id, name: 'Milanesa napolitana', description: 'Milanesa de carne con salsa, jamón y queso', price: '12.50' },
  { categoryId: CATEGORIES[0]!.id, name: 'Asado a la parrilla', description: 'Tira de asado con papas y ensalada', price: '24.00' },
  { categoryId: CATEGORIES[0]!.id, name: 'Pizza napolitana', description: 'Masa casera, muzzarella y tomate', price: '15.00' },
  { categoryId: CATEGORIES[0]!.id, name: 'Hamburguesa clásica', description: 'Medallón de 150g con papas fritas', price: '11.00' },
  { categoryId: CATEGORIES[1]!.id, name: 'Coca-Cola 500ml', description: null, price: '3.50' },
  { categoryId: CATEGORIES[1]!.id, name: 'Agua mineral 500ml', description: null, price: '2.80' },
  { categoryId: CATEGORIES[1]!.id, name: 'Jugo de naranja natural', description: 'Exprimido en el momento', price: '5.00' },
  { categoryId: CATEGORIES[2]!.id, name: 'Flan casero', description: 'Con dulce de leche o crema', price: '6.50' },
  { categoryId: CATEGORIES[2]!.id, name: 'Tiramisú', description: 'Porción de tiramisú artesanal', price: '8.00' },
  { categoryId: CATEGORIES[2]!.id, name: 'Brownie con helado', description: 'Brownie tibio con bocha de americana', price: '7.50' },
]

const MODIFIER_GROUPS: Array<{ name: string; required: boolean; min: number; max: number; modifiers: Array<{ name: string; price: string }> }> = [
  {
    name: 'Extras',
    required: false,
    min: 0,
    max: 3,
    modifiers: [
      { name: 'Queso extra', price: '1.50' },
      { name: 'Bacon', price: '2.00' },
      { name: 'Huevo frito', price: '1.00' },
    ],
  },
  {
    name: 'Punto de la carne',
    required: true,
    min: 1,
    max: 1,
    modifiers: [
      { name: 'Jugoso', price: '0.00' },
      { name: 'A punto', price: '0.00' },
      { name: 'Bien cocido', price: '0.00' },
    ],
  },
]

async function run(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query('SELECT set_app_tenant($1)', [TENANT_ID])

    for (const table of [
      'order_items',
      'payments',
      'orders',
      'shifts',
      'tables',
      'menu_item_modifiers',
      'modifiers',
      'modifier_groups',
      'menu_items',
      'menu_categories',
      'branches',
      'users',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [TENANT_ID])
    }

    await client.query(
      `INSERT INTO tenants (id, name, slug, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID, 'Restaurante Demo', 'demo-restaurante'],
    )

    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, active)
       VALUES ($1, $2, $3, $4, $5, 'admin', true)`,
      [ADMIN_USER_ID, TENANT_ID, 'admin@demo-restaurante.com', 'dev-only-placeholder-hash', 'Admin Demo'],
    )

    await client.query(
      `INSERT INTO branches (id, tenant_id, name, address, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [BRANCH_ID, TENANT_ID, 'Sucursal Centro', 'Av. Corrientes 1234, CABA', '+54 11 5555-0101'],
    )

    for (const category of CATEGORIES) {
      await client.query(
        `INSERT INTO menu_categories (id, tenant_id, name, position)
         VALUES ($1, $2, $3, $4)`,
        [category.id, TENANT_ID, category.name, category.position],
      )
    }

    const menuItemIds = new Map<string, string>()
    for (const [index, item] of MENU_ITEMS.entries()) {
      const id = randomUUID()
      menuItemIds.set(item.name, id)
      await client.query(
        `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
        [id, TENANT_ID, item.categoryId, item.name, item.description, item.price, index],
      )
    }

    const groupIds = new Map<string, string>()
    for (const group of MODIFIER_GROUPS) {
      const groupId = randomUUID()
      groupIds.set(group.name, groupId)
      await client.query(
        `INSERT INTO modifier_groups (id, tenant_id, name, required, min, max)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [groupId, TENANT_ID, group.name, group.required, group.min, group.max],
      )
      for (const modifier of group.modifiers) {
        await client.query(
          `INSERT INTO modifiers (id, tenant_id, group_id, name, price_adjustment)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), TENANT_ID, groupId, modifier.name, modifier.price],
        )
      }
    }

    const burgerId = menuItemIds.get('Hamburguesa clásica')
    const asadoId = menuItemIds.get('Asado a la parrilla')
    const extrasId = groupIds.get('Extras')
    const donenessId = groupIds.get('Punto de la carne')
    if (burgerId && asadoId && extrasId && donenessId) {
      await client.query(
        `INSERT INTO menu_item_modifiers (tenant_id, menu_item_id, modifier_group_id)
         VALUES ($1, $2, $3), ($1, $4, $5)`,
        [TENANT_ID, burgerId, extrasId, asadoId, donenessId],
      )
    }

    for (let i = 1; i <= 8; i += 1) {
      await client.query(
        `INSERT INTO tables (id, tenant_id, branch_id, label, seats, status)
         VALUES ($1, $2, $3, $4, $5, 'free')`,
        [randomUUID(), TENANT_ID, BRANCH_ID, `Mesa ${i}`, i <= 2 ? 2 : i <= 6 ? 4 : 8],
      )
    }

    await client.query('COMMIT')

    console.log('Seed completed successfully')
    console.log(`  tenant:        ${TENANT_ID} (slug: demo-restaurante)`)
    console.log(`  admin user:    admin@demo-restaurante.com`)
    console.log(`  branches:      1`)
    console.log(`  categories:    ${CATEGORIES.length}`)
    console.log(`  menu items:    ${MENU_ITEMS.length}`)
    console.log(`  mod. groups:   ${MODIFIER_GROUPS.length}`)
    console.log(`  tables:        8`)
    console.log('')
    console.log(`Connect tenant context with: SELECT set_app_tenant('${TENANT_ID}');`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
})