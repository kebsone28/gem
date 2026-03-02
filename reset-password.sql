-- Reset admin password to Touba2828Touba
-- Hash: $2b$10$KL9Z7x0V3mQ1p8X5n2L3jOwKJK5Z8x7V9w6Y3u0T4r1S2p5Q6c3Ke
UPDATE users 
SET password_hash = '$2b$10$KL9Z7x0V3mQ1p8X5n2L3jOwKJK5Z8x7V9w6Y3u0T4r1S2p5Q6c3Ke'
WHERE email = 'admin@proquelec.com';

SELECT 'Password reset successfully!' as status;
