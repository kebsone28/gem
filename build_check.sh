#!/bin/sh
cd frontend
npx vite build > ../build_stdout.txt 2> ../build_stderr.txt
echo "exit=$?" > ../build_exit.txt
