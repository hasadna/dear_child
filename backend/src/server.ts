import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { AppConfig, loadConfig } from './config/env.js';
import { buildMetaEnvelope } from './config/meta-envelope.js';

export async function buildServer(
  config: AppConfig = loadConfig()
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv !== 'test',
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie);

  // 1. Health & Readiness Endpoint for hasadna-k8s probes
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'dear-child-backend',
      active_school_year: config.activeSchoolYear,
      meta: buildMetaEnvelope(),
    };
  });

  // 2. MCP Server Metadata & Discovery Endpoint (/mcp — yaldi-hayakar-mcp, D-38)
  app.get('/mcp', async () => {
    return {
      name: 'yaldi-hayakar-mcp',
      version: '1.0.0',
      description:
        'שרת MCP רשמי של פרויקט "ילדי היקר" (הסדנא לידע ציבורי) לתשאול מאגר מעונות וגני הילדים, מחירי השוק ומרשמי הפיקוח בישראל',
      db_role: 'app_public_ro',
      tools: [
        'search_daycares',
        'get_daycare_details',
        'get_area_price_stats',
        'check_supervision_status',
        'compare_regulated_vs_market_cost',
      ],
      meta: buildMetaEnvelope(),
    };
  });

  // 3. Static Frontend Serving for unified container topology on hasadna-k8s (D-38)
  const staticDir =
    config.frontendStaticDir ||
    path.resolve(process.cwd(), '../frontend/dist');
  if (existsSync(staticDir)) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/',
    });
  }

  return app;
}

// Entrypoint when executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  const config = loadConfig();
  buildServer(config)
    .then((app) =>
      app.listen({ port: config.port, host: config.host })
    )
    .catch((err) => {
      console.error('Failed to start Dear Child server:', err);
      process.exit(1);
    });
}
