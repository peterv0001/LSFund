import { z } from 'zod';
import { 
  insertAgentSchema, 
  insertDealSchema, 
  insertAnnouncementSchema,
  insertResourceSchema,
  updateAgentProfileSchema,
  updatePayoutMethodSchema,
  subscriptionEmailPreferencesSchema,
  agents, 
  deals, 
  commissions, 
  payouts,
  notifications,
  announcements,
  resources,
  rankEnum 
} from './schema';

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
  }),
  forbidden: z.object({
    message: z.string(),
  }),
};

export const api = {
  // === AUTH ===
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertAgentSchema.extend({
        referralCode: z.string().optional(),
        sponsorId: z.number().optional(),
        placementLeg: z.enum(['left', 'right', 'auto']).default('auto'),
      }),
      responses: {
        201: z.custom<typeof agents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    searchSponsors: {
      method: 'GET' as const,
      path: '/api/sponsors/search',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          firstName: z.string(),
          lastName: z.string(),
          maskedEmail: z.string(),
          referralCode: z.string().nullable(),
        })),
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
    changePassword: {
      method: 'POST' as const,
      path: '/api/auth/change-password',
      input: z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
    forgotPassword: {
      method: 'POST' as const,
      path: '/api/auth/forgot-password',
      input: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    resetPassword: {
      method: 'POST' as const,
      path: '/api/auth/reset-password',
      input: z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
  },

  // === AGENTS (Agent Portal) ===
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
      path: '/api/agents/:id/team',
      responses: {
        200: z.any(), // Recursive tree type
      },
    },
    upline: {
      method: 'GET' as const,
      path: '/api/agents/:id/upline',
      responses: {
        200: z.array(z.custom<typeof agents.$inferSelect>()),
      },
    },
    updateProfile: {
      method: 'PATCH' as const,
      path: '/api/agents/profile',
      input: updateAgentProfileSchema,
      responses: {
        200: z.custom<typeof agents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updatePayoutMethod: {
      method: 'PATCH' as const,
      path: '/api/agents/payout-method',
      input: updatePayoutMethodSchema,
      responses: {
        200: z.custom<typeof agents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateNotificationPreferences: {
      method: 'PATCH' as const,
      path: '/api/agents/notification-preferences',
      input: subscriptionEmailPreferencesSchema,
      responses: {
        200: z.custom<typeof agents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    dashboard: {
      method: 'GET' as const,
      path: '/api/agents/dashboard',
      responses: {
        200: z.object({
          totalEarned: z.number(),
          thisWeek: z.number(),
          thisMonth: z.number(),
          pending: z.number(),
          teamSize: z.number(),
          personalVolume: z.number(),
          leftLegVolume: z.number(),
          rightLegVolume: z.number(),
          currentRank: z.string(),
          nextRank: z.string().nullable(),
          rankProgress: z.number(),
          recentDeals: z.array(z.any()),
          recentCommissions: z.array(z.any()),
        }),
      },
    },
    rankProgress: {
      method: 'GET' as const,
      path: '/api/agents/rank-progress',
      responses: {
        200: z.object({
          currentRank: z.string(),
          highestRank: z.string(),
          nextRank: z.string().nullable(),
          requirements: z.any(),
          progress: z.any(),
          qualified: z.boolean(),
        }),
      },
    },
    referralLink: {
      method: 'GET' as const,
      path: '/api/agents/referral-link',
      responses: {
        200: z.object({
          referralCode: z.string(),
          referralUrl: z.string(),
        }),
      },
    },
    referralStats: {
      method: 'GET' as const,
      path: '/api/agents/referral-stats',
      responses: {
        200: z.object({
          totalReferrals: z.number(),
          thisMonthReferrals: z.number(),
          activeReferrals: z.number(),
          recentReferrals: z.array(z.object({
            id: z.number(),
            firstName: z.string(),
            lastName: z.string(),
            createdAt: z.string(),
          })),
        }),
      },
    },
  },

  // === DEALS ===
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
    get: {
      method: 'GET' as const,
      path: '/api/deals/:id',
      responses: {
        200: z.custom<typeof deals.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === COMMISSIONS ===
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
          thisMonth: z.number(),
          byType: z.record(z.number()),
        }),
      },
    },
    breakdown: {
      method: 'GET' as const,
      path: '/api/commissions/breakdown',
      responses: {
        200: z.object({
          personal: z.number(),
          binary: z.number(),
          generation: z.number(),
          course: z.number(),
          other: z.number(),
        }),
      },
    },
  },

  // === PAYOUTS ===
  payouts: {
    list: {
      method: 'GET' as const,
      path: '/api/payouts',
      responses: {
        200: z.array(z.custom<typeof payouts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/payouts/:id',
      responses: {
        200: z.custom<typeof payouts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === NOTIFICATIONS ===
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications',
      responses: {
        200: z.array(z.custom<typeof notifications.$inferSelect>()),
      },
    },
    unreadCount: {
      method: 'GET' as const,
      path: '/api/notifications/unread-count',
      responses: {
        200: z.object({ count: z.number() }),
      },
    },
    markRead: {
      method: 'POST' as const,
      path: '/api/notifications/:id/read',
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    markAllRead: {
      method: 'POST' as const,
      path: '/api/notifications/read-all',
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },

  // === ANNOUNCEMENTS ===
  announcements: {
    list: {
      method: 'GET' as const,
      path: '/api/announcements',
      responses: {
        200: z.array(z.custom<typeof announcements.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/announcements/:id',
      responses: {
        200: z.custom<typeof announcements.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === RESOURCES ===
  resources: {
    list: {
      method: 'GET' as const,
      path: '/api/resources',
      responses: {
        200: z.array(z.custom<typeof resources.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/resources/:id',
      responses: {
        200: z.custom<typeof resources.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    byCategory: {
      method: 'GET' as const,
      path: '/api/resources/category/:category',
      responses: {
        200: z.array(z.custom<typeof resources.$inferSelect>()),
      },
    },
  },

  // === TRAINING / COURSES ===
  training: {
    modules: {
      method: 'GET' as const,
      path: '/api/training/modules',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          moduleNumber: z.number(),
          title: z.string(),
          description: z.string().nullable(),
          videoUrl: z.string().nullable(),
          durationSeconds: z.number().nullable(),
          slideCount: z.number(),
          isPublished: z.boolean(),
        })),
      },
    },
    progress: {
      method: 'GET' as const,
      path: '/api/training/progress',
      responses: {
        200: z.object({
          modules: z.array(z.object({
            id: z.number(),
            moduleNumber: z.number(),
            title: z.string(),
            description: z.string().nullable(),
            videoUrl: z.string().nullable(),
            durationSeconds: z.number().nullable(),
            slideCount: z.number(),
            isPublished: z.boolean(),
            progress: z.object({
              moduleId: z.number(),
              status: z.enum(['not_started', 'in_progress', 'completed']),
              currentSlide: z.number(),
              completedSlides: z.number(),
              quizScore: z.number().nullable(),
            }).nullable(),
          })),
          overallProgress: z.number(),
          completedModules: z.number(),
          totalModules: z.number(),
        }),
      },
    },
    updateProgress: {
      method: 'POST' as const,
      path: '/api/training/progress/:moduleId',
      input: z.object({
        status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
        currentSlide: z.number().optional(),
        completedSlides: z.number().optional(),
        quizScore: z.number().min(0).max(100).optional(),
      }),
      responses: {
        200: z.object({
          id: z.number(),
          agentId: z.number(),
          moduleId: z.number(),
          status: z.string(),
          currentSlide: z.number().nullable(),
          completedSlides: z.number().nullable(),
          quizScore: z.number().nullable(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },

  // === LEADERBOARDS ===
  leaderboards: {
    topEarners: {
      method: 'GET' as const,
      path: '/api/leaderboards/top-earners',
      responses: {
        200: z.array(z.object({
          agentId: z.number(),
          firstName: z.string(),
          lastName: z.string(),
          profileImageUrl: z.string().nullable(),
          currentRank: z.string(),
          totalEarned: z.number(),
        })),
      },
    },
    topRecruiters: {
      method: 'GET' as const,
      path: '/api/leaderboards/top-recruiters',
      responses: {
        200: z.array(z.object({
          agentId: z.number(),
          firstName: z.string(),
          lastName: z.string(),
          profileImageUrl: z.string().nullable(),
          currentRank: z.string(),
          recruits: z.number(),
        })),
      },
    },
    rankAdvances: {
      method: 'GET' as const,
      path: '/api/leaderboards/rank-advances',
      responses: {
        200: z.array(z.object({
          agentId: z.number(),
          firstName: z.string(),
          lastName: z.string(),
          profileImageUrl: z.string().nullable(),
          newRank: z.string(),
          advancedAt: z.string(),
        })),
      },
    },
  },

  // === ADMIN ===
  admin: {
    // Dashboard
    stats: {
      method: 'GET' as const,
      path: '/api/admin/stats',
      responses: {
        200: z.object({
          totalAgents: z.number(),
          activeAgents: z.number(),
          newAgentsThisWeek: z.number(),
          totalDeals: z.number(),
          dealsThisWeek: z.number(),
          totalVolume: z.number(),
          volumeThisWeek: z.number(),
          totalCommissions: z.number(),
          pendingCommissions: z.number(),
          pendingPayouts: z.number(),
        }),
      },
    },

    // Agent Management
    agents: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/agents',
        responses: {
          200: z.object({
            agents: z.array(z.custom<typeof agents.$inferSelect & { subscriptionCount: number }>()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
      get: {
        method: 'GET' as const,
        path: '/api/admin/agents/:id',
        responses: {
          200: z.custom<typeof agents.$inferSelect>(),
          404: errorSchemas.notFound,
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/agents/:id',
        input: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          currentRank: z.enum(['agent', 'builder', 'leader', 'director', 'partner']).optional(),
          status: z.enum(['active', 'inactive', 'suspended']).optional(),
          isAdmin: z.boolean().optional(),
        }),
        responses: {
          200: z.custom<typeof agents.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
      suspend: {
        method: 'POST' as const,
        path: '/api/admin/agents/:id/suspend',
        input: z.object({ reason: z.string().optional() }),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      activate: {
        method: 'POST' as const,
        path: '/api/admin/agents/:id/activate',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      impersonate: {
        method: 'POST' as const,
        path: '/api/admin/agents/:id/impersonate',
        responses: {
          200: z.object({ token: z.string() }),
          403: errorSchemas.forbidden,
          501: z.object({ message: z.string() }),
        },
      },
    },

    // Deal Management
    deals: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/deals',
        responses: {
          200: z.object({
            deals: z.array(z.any()), // Deal with agent info
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
      approve: {
        method: 'POST' as const,
        path: '/api/admin/deals/:id/approve',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      reject: {
        method: 'POST' as const,
        path: '/api/admin/deals/:id/reject',
        input: z.object({ reason: z.string() }),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/deals/:id',
        input: z.object({
          merchantName: z.string().optional(),
          loanAmount: z.number().optional(),
          gbrAmount: z.number().optional(),
          fulfillmentAgentId: z.number().optional(),
          status: z.enum(['pending', 'funded', 'rejected']).optional(),
          notes: z.string().optional(),
        }),
        responses: {
          200: z.custom<typeof deals.$inferSelect>(),
        },
      },
    },

    // Commission Management
    commissions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/commissions',
        responses: {
          200: z.object({
            commissions: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
      pending: {
        method: 'GET' as const,
        path: '/api/admin/commissions/pending',
        responses: {
          200: z.array(z.any()),
        },
      },
      approve: {
        method: 'POST' as const,
        path: '/api/admin/commissions/:id/approve',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      approveAll: {
        method: 'POST' as const,
        path: '/api/admin/commissions/approve-all',
        responses: {
          200: z.object({ approved: z.number() }),
        },
      },
      void: {
        method: 'POST' as const,
        path: '/api/admin/commissions/:id/void',
        input: z.object({ reason: z.string() }),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      calculate: {
        method: 'POST' as const,
        path: '/api/admin/commissions/calculate',
        responses: {
          200: z.object({ message: z.string(), processed: z.number() }),
        },
      },
    },

    // Payout Management
    payouts: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/payouts',
        responses: {
          200: z.object({
            payouts: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
      preview: {
        method: 'GET' as const,
        path: '/api/admin/payouts/preview',
        responses: {
          200: z.object({
            agents: z.array(z.object({
              agentId: z.number(),
              firstName: z.string(),
              lastName: z.string(),
              email: z.string(),
              amount: z.number(),
              commissionCount: z.number(),
            })),
            totalAmount: z.number(),
            totalAgents: z.number(),
          }),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/payouts/create',
        input: z.object({
          periodStart: z.string(),
          periodEnd: z.string(),
          agentIds: z.array(z.number()).optional(), // If not provided, all eligible
        }),
        responses: {
          200: z.object({
            created: z.number(),
            totalAmount: z.number(),
          }),
        },
      },
      process: {
        method: 'POST' as const,
        path: '/api/admin/payouts/:id/process',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      markPaid: {
        method: 'POST' as const,
        path: '/api/admin/payouts/:id/mark-paid',
        input: z.object({
          externalId: z.string().optional(),
          notes: z.string().optional(),
        }),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },

    // Announcement Management
    announcements: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/announcements',
        responses: {
          200: z.array(z.custom<typeof announcements.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/announcements',
        input: insertAnnouncementSchema,
        responses: {
          201: z.custom<typeof announcements.$inferSelect>(),
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/announcements/:id',
        input: insertAnnouncementSchema.partial(),
        responses: {
          200: z.custom<typeof announcements.$inferSelect>(),
        },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/announcements/:id',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
      publish: {
        method: 'POST' as const,
        path: '/api/admin/announcements/:id/publish',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },

    // Resource Management
    resources: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/resources',
        responses: {
          200: z.array(z.custom<typeof resources.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/resources',
        input: insertResourceSchema,
        responses: {
          201: z.custom<typeof resources.$inferSelect>(),
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/resources/:id',
        input: insertResourceSchema.partial(),
        responses: {
          200: z.custom<typeof resources.$inferSelect>(),
        },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/resources/:id',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },

    // System Settings
    settings: {
      get: {
        method: 'GET' as const,
        path: '/api/admin/settings',
        responses: {
          200: z.object({
            commissionRates: z.any(),
            rankRequirements: z.any(),
            binaryBonusCaps: z.any(),
            companyInfo: z.any(),
          }),
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/settings',
        input: z.object({
          commissionRates: z.any().optional(),
          rankRequirements: z.any().optional(),
          binaryBonusCaps: z.any().optional(),
          companyInfo: z.any().optional(),
        }),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },

    // Subscription Management
    subscriptions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/subscriptions',
        responses: {
          200: z.array(z.any()),
        },
      },
      updateStatus: {
        method: 'PATCH' as const,
        path: '/api/admin/subscriptions/:id/status',
        input: z.object({
          status: z.enum(['active', 'paused', 'cancelled', 'expired']),
        }),
        responses: {
          200: z.any(),
        },
      },
      calculateCommissions: {
        method: 'POST' as const,
        path: '/api/admin/subscriptions/calculate-commissions',
        responses: {
          200: z.object({ message: z.string(), processed: z.number(), totalActive: z.number() }),
        },
      },
      activity: {
        method: 'GET' as const,
        path: '/api/admin/subscriptions/:id/activity',
        responses: {
          200: z.array(z.any()),
        },
      },
    },

    // Holdback Management
    holdbacks: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/holdbacks',
        responses: {
          200: z.array(z.any()),
        },
      },
      pending: {
        method: 'GET' as const,
        path: '/api/admin/holdbacks/pending',
        responses: {
          200: z.array(z.any()),
        },
      },
      release: {
        method: 'POST' as const,
        path: '/api/admin/holdbacks/:id/release',
        responses: {
          200: z.any(),
        },
      },
      clawback: {
        method: 'POST' as const,
        path: '/api/admin/holdbacks/:id/clawback',
        input: z.object({
          reason: z.string().optional(),
          percentage: z.number().min(0).max(100).optional(),
        }),
        responses: {
          200: z.any(),
        },
      },
      releaseEligible: {
        method: 'POST' as const,
        path: '/api/admin/holdbacks/release-eligible',
        responses: {
          200: z.object({ message: z.string(), released: z.number() }),
        },
      },
    },

    // Activity Log
    activityLog: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/activity-log',
        responses: {
          200: z.object({
            logs: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
    },

    // Lead Management
    leads: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/leads',
        responses: {
          200: z.object({
            leads: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
      stats: {
        method: 'GET' as const,
        path: '/api/admin/leads/stats',
        responses: {
          200: z.object({
            total: z.number(),
            unassigned: z.number(),
            byStatus: z.record(z.number()),
            aiFollowupPending: z.number(),
          }),
        },
      },
      upload: {
        method: 'POST' as const,
        path: '/api/admin/leads/upload',
        input: z.object({
          leads: z.array(z.object({
            contactName: z.string(),
            contactEmail: z.string().optional(),
            contactPhone: z.string().optional(),
            companyName: z.string().optional(),
            companySize: z.string().optional(),
            industry: z.string().optional(),
            address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            zip: z.string().optional(),
            source: z.string().optional(),
          })),
          batchId: z.string().optional(),
        }),
        responses: {
          201: z.object({
            created: z.number(),
            batchId: z.string(),
          }),
        },
      },
      assign: {
        method: 'POST' as const,
        path: '/api/admin/leads/assign',
        input: z.object({
          leadIds: z.array(z.number()),
          agentId: z.number(),
        }),
        responses: {
          200: z.object({
            assigned: z.number(),
          }),
        },
      },
      unassigned: {
        method: 'GET' as const,
        path: '/api/admin/leads/unassigned',
        responses: {
          200: z.array(z.any()),
        },
      },
      aiQueue: {
        method: 'GET' as const,
        path: '/api/admin/leads/ai-queue',
        responses: {
          200: z.array(z.any()),
        },
      },
      markAIProcessed: {
        method: 'POST' as const,
        path: '/api/admin/leads/:id/ai-processed',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },

    // Lead Requests
    leadRequests: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/lead-requests',
        responses: {
          200: z.object({
            requests: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
      pending: {
        method: 'GET' as const,
        path: '/api/admin/lead-requests/pending',
        responses: {
          200: z.array(z.any()),
        },
      },
      respond: {
        method: 'POST' as const,
        path: '/api/admin/lead-requests/:id/respond',
        input: z.object({
          status: z.enum(['approved', 'denied', 'fulfilled']),
          responseNotes: z.string().optional(),
          leadsAssigned: z.number().optional(),
        }),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
  },

  // === SUBSCRIPTIONS ===
  subscriptions: {
    list: {
      method: 'GET' as const,
      path: '/api/subscriptions',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subscriptions',
      input: z.object({
        merchantName: z.string(),
        merchantEmail: z.string().email().optional(),
        tier: z.enum(['tier_1', 'tier_2', 'tier_3']),
        mcaPairedDealId: z.number().optional(),
      }),
      responses: {
        201: z.any(),
      },
    },
  },

  // === MIGRATIONS (Admin) ===
  migrations: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/migrations',
      responses: {
        200: z.array(z.object({
          name: z.string(),
          hasDown: z.boolean(),
          appliedAt: z.string().nullable(),
        })),
      },
    },
  },

  // === HOLDBACKS (Agent Portal) ===
  holdbacks: {
    list: {
      method: 'GET' as const,
      path: '/api/holdbacks',
      responses: {
        200: z.array(z.any()),
      },
    },
  },

  // === LEADS (Agent Portal) ===
  leads: {
    list: {
      method: 'GET' as const,
      path: '/api/leads',
      responses: {
        200: z.array(z.any()),
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/leads/:id/status',
      input: z.object({
        status: z.enum(['new', 'contacted', 'warm', 'hot', 'qualified', 'submitted', 'closed_won', 'closed_lost', 'ai_followup']),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.any(),
      },
    },
    requestAIFollowup: {
      method: 'POST' as const,
      path: '/api/leads/:id/ai-followup',
      responses: {
        200: z.any(),
      },
    },
    requestMore: {
      method: 'POST' as const,
      path: '/api/leads/request',
      input: z.object({
        requestedCount: z.number().min(1).max(100).default(10),
        preferredIndustry: z.string().optional(),
        preferredLocation: z.string().optional(),
        notes: z.string().optional(),
      }),
      responses: {
        201: z.any(),
      },
    },
    myRequests: {
      method: 'GET' as const,
      path: '/api/leads/requests',
      responses: {
        200: z.array(z.any()),
      },
    },
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

// Helper to add query params
export function buildUrlWithQuery(
  path: string, 
  params?: Record<string, string | number>,
  query?: Record<string, string | number | boolean | undefined>
): string {
  let url = buildUrl(path, params);
  if (query) {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  return url;
}
