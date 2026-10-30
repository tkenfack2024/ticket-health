export const TENANTS = {
  'entreprise-test': {
    name: 'Clinique Test',
    url: 'libsql://entreprise-test-kenfack.aws-eu-west-1.turso.io',
    token: process.env.TURSO_TOKEN_TEST || '',
  },
  'entreprise-alpha': {
    name: 'Hôpital Alpha',
    url: 'libsql://entreprise-alpha-kenfack.aws-eu-west-1.turso.io',
    token: process.env.TURSO_TOKEN_ALPHA || '',
  },
  'entreprise-beta': {
    name: 'Clinique Beta',
    url: 'libsql://entreprise-beta-kenfack.aws-eu-west-1.turso.io',
    token: process.env.TURSO_TOKEN_BETA || '',
  },
};