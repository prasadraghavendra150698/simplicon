import { defineConfig, type Plugin } from 'vite';
import { apiMiddleware } from './src/vite-plugin-api'; // Handshaking API mock

function prettyUrlRewrites(): Plugin {
  const rewrites: Record<string, string> = {
    '/about': '/about.html',
    '/contact': '/contact.html',
    '/services': '/services.html',
    '/pricing': '/pricing.html',
    '/resources': '/resources.html',
    '/auth': '/auth.html',
    '/portal': '/portal.html',
    '/admin': '/admin.html',
    '/admin-requests': '/admin-requests.html',
    '/admin-ticket': '/admin-ticket.html',
    '/admin-access': '/admin-access.html',
    '/admin-members': '/admin-members.html',
  };

  return {
    name: 'pretty-url-rewrites',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();

        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname.endsWith('/') && url.pathname !== '/' ? url.pathname.slice(0, -1) : url.pathname;
        const dest = rewrites[path];
        if (dest) {
          url.pathname = dest;
          req.url = url.pathname + url.search;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    apiMiddleware(), // Local API handling
    prettyUrlRewrites()
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        contact: 'contact.html',
        pricing: 'pricing.html',
        resources: 'resources.html',
        services: 'services.html',
        auth: 'auth.html',
        portal: 'portal.html',
        admin: 'admin.html',
        adminRequests: 'admin-requests.html',
        adminTicket: 'admin-ticket.html',
        adminAccess: 'admin-access.html',
        adminMembers: 'admin-members.html',
      },
    },
  },
});
