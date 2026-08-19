import { AppError } from '../../shared/errors.js'

export type UserRole = 'owner' | 'admin' | 'staff'

export interface AuthUser {
  id: string
  email: string
  password: string
  tenantId: string
  role: UserRole
}

export interface PublicUser {
  id: string
  email: string
  tenantId: string
  role: UserRole
}

export class AuthService {
  private readonly users: AuthUser[] = [
    {
      // Alineado con el seed de packages/db (tenant y usuario del demo):
      // - tenantId coincide con el tenant sembrado en la migración/seed.
      // - email coincide con el usuario admin del seed.
      // Sin esto, el JWT llevaría un tenant inexistente y el dashboard
      // (RLS por tenant) respondería siempre con ceros.
      id: '33333333-3333-3333-3333-333333333333',
      email: 'admin@demo-restaurante.com',
      password: 'admin123',
      tenantId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
    },
  ]

  async authenticate(email: string, password: string): Promise<PublicUser> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = this.users.find((candidate) => candidate.email === normalizedEmail)
    if (!user || user.password !== password) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }
    return this.toPublic(user)
  }

  private toPublic(user: AuthUser): PublicUser {
    return { id: user.id, email: user.email, tenantId: user.tenantId, role: user.role }
  }
}