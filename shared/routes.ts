import { z } from 'zod';
import { insertAgentSchema, insertDealSchema, agents, deals, commissions, rankEnum } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  })
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertAgentSchema.extend({
        referralCode: z.string().optional(),
        placementLeg: z.enum(['left', 'right', 'auto']).default('auto'),
      }),
      responses: {
        201: z.custom<typeof agents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof agents.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof agents.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  agents: {
    get: {
      method: 'GET' as const,
      path: '/api/agents/:id',
      responses: {
        200: z.custom<typeof agents.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    team: {
      method: 'GET' as const,
      path: '/api/agents/:id/team', // Returns binary tree structure
      responses: {
        200: z.any(), // Recursive type definition is hard in Zod, using any for tree
      },
    },
    search: {
      method: 'GET' as const,
      path: '/api/agents/search',
      input: z.object({ query: z.string() }),
      responses: {
        200: z.array(z.custom<typeof agents.$inferSelect>()),
      }
    }
  },
  deals: {
    create: {
      method: 'POST' as const,
      path: '/api/deals',
      input: insertDealSchema,
      responses: {
        201: z.custom<typeof deals.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/deals',
      responses: {
        200: z.array(z.custom<typeof deals.$inferSelect>()),
      },
    },
  },
  commissions: {
    list: {
      method: 'GET' as const,
      path: '/api/commissions',
      responses: {
        200: z.array(z.custom<typeof commissions.$inferSelect>()),
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/commissions/stats',
      responses: {
        200: z.object({
          totalEarned: z.number(),
          pending: z.number(),
          thisWeek: z.number(),
        }),
      },
    },
    calculate: { // Admin only
      method: 'POST' as const,
      path: '/api/admin/calculate-commissions',
      responses: {
        200: z.object({ message: z.string(), processed: z.number() }),
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
