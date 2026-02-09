
import { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import handler from '../api/notify';

// Simple body parser middleware for dev server
function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

export function apiMiddleware(): Plugin {
    return {
        name: 'vite-plugin-api-middleware',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.startsWith('/api/notify') && req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        // Mock the Vercel/Express req/res objects
                        const mockReq = {
                            method: req.method,
                            body,
                            headers: req.headers
                        };

                        const mockRes = {
                            status: (code: number) => {
                                res.statusCode = code;
                                return mockRes;
                            },
                            json: (data: any) => {
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify(data));
                                return mockRes;
                            },
                            setHeader: (name: string, value: string) => {
                                res.setHeader(name, value);
                                return mockRes;
                            },
                            end: () => res.end()
                        };

                        // Call the actual handler
                        await handler(mockReq, mockRes);
                    } catch (e: any) {
                        console.error('API Middleware Error:', e);
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: e.message }));
                    }
                } else {
                    next();
                }
            });
        }
    };
}
