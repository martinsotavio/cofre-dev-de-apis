# Contexto de build deste servico e' a raiz do projeto (ver docker-compose.yml),
# para poder copiar tanto a config do Nginx quanto os arquivos do frontend.
FROM nginx:1.27-alpine

COPY gateway/nginx.conf /etc/nginx/nginx.conf
COPY frontend /usr/share/nginx/html
