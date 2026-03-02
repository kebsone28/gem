FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend files (exclude server, node_modules, etc.)
COPY *.html /usr/share/nginx/html/
COPY *.js /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY lib/ /usr/share/nginx/html/lib/
COPY Liste/ /usr/share/nginx/html/Liste/
COPY KOBO/ /usr/share/nginx/html/KOBO/

EXPOSE 80
