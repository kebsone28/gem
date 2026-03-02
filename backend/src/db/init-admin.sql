-- Update admin user password
-- Password: proquelec123
-- Hash: $2b$10$xKZ3pjGAqVQ7T8E9m2K9hOp1K5V3eL8S9c4qZ8xY7sW3pN2bJ9x2e
UPDATE users 
SET password_hash = '$2b$10$xKZ3pjGAqVQ7T8E9m2K9hOp1K5V3eL8S9c4qZ8xY7sW3pN2bJ9x2e'
WHERE email = 'admin@proquelec.com';
