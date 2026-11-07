module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'db'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'vertical'),
      user: env('DATABASE_USERNAME', 'vertical'),
      password: env('DATABASE_PASSWORD'),
      ssl: false,
    },
    pool: { min: 0, max: 10 },
  },
});
