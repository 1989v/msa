export interface JwtPayload {
  userId: string;
  roles: string[];
  type: string;
  exp: number;
  iat: number;
}

export interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
}
