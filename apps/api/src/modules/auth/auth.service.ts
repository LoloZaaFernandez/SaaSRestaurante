import bcrypt from 'bcryptjs'
import { AppError } from '../../shared/errors.js'
import { isUniqueViolation } from '../../shared/db.js'
import type { UsersRepository, UserRole, UserRow } from './users.repository.js'

const SALT_ROUNDS = 10

export interface PublicUser {
  id: string
  email: string
  tenantId: string
  role: UserRole
  fullName: string
}

export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async authenticate(email: string, password: string): Promise<PublicUser> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.usersRepository.findByEmail(normalizedEmail)
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }
    if (!user.active) {
      throw new AppError(403, 'USER_INACTIVE', 'User is no longer active')
    }
    return this.toPublic(user)
  }

  findById(id: string, tenantId: string): Promise<UserRow | null> {
    return this.usersRepository.findById(id, tenantId)
  }

  async registerInTenant(
    tenantId: string,
    input: {
      email: string
      password: string
      fullName: string
      role: UserRole
    },
  ): Promise<PublicUser> {
    try {
      const user = await this.usersRepository.createInTenant(tenantId, {
        email: input.email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
        fullName: input.fullName.trim(),
        role: input.role,
      })
      return this.toPublic(user)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, 'EMAIL_EXISTS', 'A user with that email already exists')
      }
      throw err
    }
  }

  toPublic(user: UserRow): PublicUser {
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      fullName: user.fullName,
    }
  }
}