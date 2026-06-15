# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.



Terminal 1 — Backend (API): 

cd c:\Users\user\Downloads\comuna
npm run dev:api

Terminal 2 — Frontend:

cd c:\Users\user\Downloads\comuna
npm run dev

## Seguridad (API `/api/auth`)

- **Intentos fallidos de login**: tras varias contraseñas incorrectas para la misma combinación **IP + usuario**, la API responde `429` con `retryAfterSeconds` (configurable con `AUTH_LOGIN_*` en `.env`).
- **Recuperación de contraseña**: mismo patrón para respuestas de seguridad incorrectas (`AUTH_RECOVERY_*`).
- **Rate limiting** por IP (`express-rate-limit`) en login, registro, consultas sensibles (salt, preguntas) y reset; límite global sobre todas las rutas `/api/auth`. Ver `.env.example`.
- Con proxy inverso, define `TRUST_PROXY=1` para que la IP del cliente se lea bien desde `X-Forwarded-For`.
- El contador de intentos está **en memoria** (un solo proceso Node); con varias réplicas hace falta un almacén compartido (p. ej. Redis).

## Administrador, voceros y datos por calle

1. **Migración BD** (una vez): ejecuta `server/sql/migrations/002_usuario_admin.sql` para añadir `is_admin` a `usuarios`.
2. **JWT**: define `JWT_SECRET` en `.env` del servidor (obligatorio en producción).
3. **Primer usuario = administrador**: si la tabla `usuarios` está **vacía**, la pantalla de login muestra **Registrarte** y la **primera cuenta** que crees queda con `is_admin = true` automáticamente. A partir del segundo usuario, el registro público se oculta y solo un administrador puede crear voceros desde **Administración**.
4. **Empezar de cero** (por ejemplo para borrar tu usuario de prueba): en PostgreSQL, `DELETE FROM usuarios WHERE user_id = 'tu_correo_o_cedula';` o `DELETE FROM usuarios;` para vaciar todas las cuentas. Vuelve a registrarte y serás de nuevo el primer administrador.
5. **Registro público opcional**: con `ALLOW_PUBLIC_REGISTER=true` en la API cualquiera puede registrarse (cuentas nuevas **no** son admin salvo que sigan siendo el primer usuario de una BD vacía). Úsalo solo si lo necesitas.
6. **Voceros**: al iniciar sesión solo ven habitantes y pagos de **su calle** dentro de **su consejo**.
7. **Restablecer contraseña de un vocero**: desde Administración, icono de llave.

## Enlaces de Producción

- **Frontend (Vercel)**: [https://comuna-un-paso-al-frente.vercel.app/](https://comuna-un-paso-al-frente.vercel.app/)
- **Backend / API (Render)**: [https://comuna-backend-982q.onrender.com](https://comuna-backend-982q.onrender.com)