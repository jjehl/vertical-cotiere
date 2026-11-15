module.exports = ({ env }) => ({
  email: {config: {
    provider:'nodemailer',
    providerOptions: {
      host:env('SMTP_HOST','ssl0.ovh.net'),port:env.int('SMTP_PORT',465),secure:env.bool('SMTP_SECURE',true),
      requireTLS:!env.bool('SMTP_SECURE',true),
      auth:{user:env('SMTP_USER',''),pass:env('SMTP_PASSWORD','')},
      connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000,
    },
    settings: {defaultFrom:env('EMAIL_FROM')||env('SMTP_USER')||'no-reply@vertical-cotiere.fr',defaultReplyTo:env('EMAIL_FROM')||env('SMTP_USER')||'no-reply@vertical-cotiere.fr'},
  }},
  'users-permissions': { config: {
    jwtSecret: env('JWT_SECRET'), jwt: {expiresIn:'8h'},
    register: {allowedFields:['firstName','lastName']},
    validationRules: {validatePassword: value => typeof value==='string'&&value.length>=12&&Buffer.byteLength(value,'utf8')<=72},
  } },
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
