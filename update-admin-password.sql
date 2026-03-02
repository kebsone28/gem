-- Réinitialiser le mot de passe admin
-- Mot de passe: Touba2828Touba
-- Hash bcrypt: $2a$10$38i3F5KWizjjzVTHprsWbOpOKpDpRI4UowhoTiYQ1Ibr2mpT.vNhm
UPDATE users SET password_hash = '$2a$10$38i3F5KWizjjzVTHprsWbOpOKpDpRI4UowhoTiYQ1Ibr2mpT.vNhm' WHERE email = 'admin@proquelec.com';

-- Vérifier la mise à jour
SELECT email, password_hash FROM users WHERE email = 'admin@proquelec.com';
