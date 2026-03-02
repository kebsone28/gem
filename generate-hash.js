const bcrypt = require('bcryptjs');

const password = 'Touba2828Touba';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log(hash);
  process.exit(0);
});
