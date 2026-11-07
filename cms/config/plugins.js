module.exports = ({ env }) => ({
  'users-permissions': { config: { jwtSecret: env('JWT_SECRET') } },
  'publication-assistant': { enabled: true, resolve: './src/plugins/publication-assistant' },
});
