export const config = {
  projectName: process.env.PROJECT_NAME || 'Carwash POS',
  secretKey: process.env.SECRET_KEY || 'YOUR_SUPER_SECRET_KEY',
  algorithm: 'HS256' as const,
  accessTokenExpireMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10080', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};