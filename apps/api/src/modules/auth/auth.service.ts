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
      id: 'usr_1',
      email: 'admin@saas.local',
      password: 'admin123',
      tenantId: 'tnt_demo',
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