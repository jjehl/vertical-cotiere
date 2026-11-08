module.exports = ({ env }) => ({
  'users-permissions': { config: { jwtSecret: env('JWT_SECRET') } },
  'publication-assistant': { enabled: true, resolve: './src/plugins/publication-assistant' },
  ...(env('UPLOAD_PROVIDER', 'local') === 'aws-s3' ? {
    upload: { config: {
      provider: 'aws-s3',
      providerOptions: {
        baseUrl: env('S3_PUBLIC_URL'),
        rootPath: env('S3_ROOT_PATH', ''),
        s3Options: {
          endpoint: env('S3_ENDPOINT'),
          region: env('S3_REGION', 'us-east-1'),
          forcePathStyle: env.bool('S3_FORCE_PATH_STYLE', true),
          credentials: { accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY') },
          // Optional checksums improve compatibility with non-AWS services.
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
          params: { Bucket: env('S3_BUCKET'), ACL: 'public-read' },
        },
      },
    } },
  } : {}),
});
