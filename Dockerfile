FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar configuración de paquetes
COPY package*.json ./

# Instalar TODAS las dependencias (necesarias para construir la web con Vite)
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar la aplicación React con Vite y el servidor backend
RUN npm run build

# Definir el entorno como producción
ENV NODE_ENV=production

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar el servidor de producción compilado
CMD ["npm", "start"]
