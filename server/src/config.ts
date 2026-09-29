export const config = {
  projectName: process.env.PROJECT_NAME || 'Carwash POS',
  secretKey:
    process.env.SECRET_KEY ||
    '03f2b7c6d91e4aa58c1f9be4d7a2c6b8e5f304a17d92b6c48a1d0e9f3c7b5a2d',
  algorithm: 'HS256' as const,
  accessTokenExpireMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10080', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres.uiovshfqcrqbluvxhzif:Nur%212651%2124@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    'https://extreme-cw.vercel.app,http://localhost:5173'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};