import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://proquelec:proquelec_secure_2024@127.0.0.1:5435/electrification?schema=public'
});

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('Project', 'Team') 
      AND column_name IN ('id', 'projectId')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

main();
