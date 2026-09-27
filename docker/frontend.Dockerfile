FROM nginx:1.27-alpine
COPY frontend /usr/share/nginx/html
COPY docker/nginx.template.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
