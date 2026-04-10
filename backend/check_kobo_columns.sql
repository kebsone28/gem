SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='Household' 
AND column_name LIKE '%kobo%'
ORDER BY column_name;
