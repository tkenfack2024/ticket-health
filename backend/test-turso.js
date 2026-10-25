import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://entreprise-test-kenfack.aws-eu-west-1.turso.io', // ex: libsql://entreprise-test-kenfack.turso.io
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI4MzY1NTcsImlkIjoiMDFhMTZkNWYtZTYwMS03ZWY0LTljYTYtYzdhYWNlZTk2ZjM0Iiwia2lkIjoiSGpUcDJWeWwzR09ZbmJwR1NLN29TR0p4YTB1X01xSXNkQTFlUU1teTBiNCIsInJpZCI6IjU2ZGRkMTRmLTc0YzktNDc0ZC04NzZhLWIyNGQxZTEwMmQ1YSJ9.CDN063wvslkijnkYFDRUyfdx7cKFOiqSyh7zPEb1aHcjwFDTRRVRRkVNfuQ-TtQI1JGwPAT7Y8pV4GPXseS7Bg',
});

async function test() {
  try {
    const result = await db.execute('SELECT 1 as test');
    console.log('✅ Connexion à Turso réussie ! Résultat :', result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur de connexion :', err);
  }
}

test();