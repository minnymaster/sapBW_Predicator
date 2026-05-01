export type UserRole = 'employee' | 'hr' | 'director';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}
