-- Fix SystemError and SystemConfig tables ownership and permissions
ALTER TABLE IF EXISTS public."SystemError" OWNER TO proquelec_user;
ALTER TABLE IF EXISTS public."SystemConfig" OWNER TO proquelec_user;

GRANT ALL PRIVILEGES ON TABLE public."SystemError" TO proquelec_user;
GRANT ALL PRIVILEGES ON TABLE public."SystemConfig" TO proquelec_user;

-- Confirm tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('SystemError', 'SystemConfig');
