import type { Route, IAgentRuntime } from '@elizaos/core';
import { AutonomousServiceType } from './types';

interface RouteRequest {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

interface RouteResponse {
  status: (code: number) => RouteResponse;
  json: (data: unknown) => unknown;
}

interface AutonomyService {
  getStatus: () => {
    enabled: boolean;
    running: boolean;
    interval: number;
    autonomousRoomId?: string;
  };
  enableAutonomy: () => Promise<void>;
  disableAutonomy: () => Promise<void>;
  setLoopInterval: (interval: number) => void;
}

/**
 * Simple API routes for controlling autonomy via settings
 */
export const autonomyRoutes: Route[] = [
  {
    path: '/autonomy/status',
    type: 'GET',
    handler: async (req: RouteRequest, res: RouteResponse, runtime: IAgentRuntime) => {
      void req; // Request currently unused but kept for signature compatibility

      const autonomyService = runtime.getService(AutonomousServiceType.AUTONOMOUS);

      if (!autonomyService) {
        res.status(503).json({
          error: 'Autonomy service not available',
        });
        return;
      }

      const status = (autonomyService as unknown as AutonomyService).getStatus();

      res.json({
        success: true,
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
          intervalSeconds: Math.round(status.interval / 1000),
          autonomousRoomId: status.autonomousRoomId,
          agentId: runtime.agentId,
          characterName: runtime.character?.name || 'Agent',
        },
      });
    },
  },

  {
    path: '/autonomy/enable',
    type: 'POST',
    handler: async (req: RouteRequest, res: RouteResponse, runtime: IAgentRuntime) => {
      void req; // Request currently unused but kept for signature compatibility

      const autonomyService = runtime.getService(AutonomousServiceType.AUTONOMOUS);

      if (!autonomyService) {
        res.status(503).json({
          success: false,
          error: 'Autonomy service not available',
        });
        return;
      }

      await (autonomyService as unknown as AutonomyService).enableAutonomy();
      const status = (autonomyService as unknown as AutonomyService).getStatus();

      res.json({
        success: true,
        message: 'Autonomy enabled',
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
        },
      });
    },
  },

  {
    path: '/autonomy/disable',
    type: 'POST',
    handler: async (req: RouteRequest, res: RouteResponse, runtime: IAgentRuntime) => {
      void req; // Request currently unused but kept for signature compatibility

      const autonomyService = runtime.getService(AutonomousServiceType.AUTONOMOUS);

      if (!autonomyService) {
        res.status(503).json({
          success: false,
          error: 'Autonomy service not available',
        });
        return;
      }

      await (autonomyService as unknown as AutonomyService).disableAutonomy();
      const status = (autonomyService as unknown as AutonomyService).getStatus();

      res.json({
        success: true,
        message: 'Autonomy disabled',
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
        },
      });
    },
  },

  {
    path: '/autonomy/toggle',
    type: 'POST',
    handler: async (req: RouteRequest, res: RouteResponse, runtime: IAgentRuntime) => {
      void req; // Request currently unused but kept for signature compatibility

      const autonomyService = runtime.getService(AutonomousServiceType.AUTONOMOUS);

      if (!autonomyService) {
        res.status(503).json({
          success: false,
          error: 'Autonomy service not available',
        });
        return;
      }

      const currentStatus = (autonomyService as unknown as AutonomyService).getStatus();

      if (currentStatus.enabled) {
        await (autonomyService as unknown as AutonomyService).disableAutonomy();
      } else {
        await (autonomyService as unknown as AutonomyService).enableAutonomy();
      }

      const newStatus = (autonomyService as unknown as AutonomyService).getStatus();

      res.json({
        success: true,
        message: newStatus.enabled ? 'Autonomy enabled' : 'Autonomy disabled',
        data: {
          enabled: newStatus.enabled,
          running: newStatus.running,
          interval: newStatus.interval,
        },
      });
    },
  },

  {
    path: '/autonomy/interval',
    type: 'POST',
    handler: async (req: RouteRequest, res: RouteResponse, runtime: IAgentRuntime) => {
      const autonomyService = runtime.getService(AutonomousServiceType.AUTONOMOUS);

      if (!autonomyService) {
        res.status(503).json({
          success: false,
          error: 'Autonomy service not available',
        });
        return;
      }

      const { interval } = req.body as { interval?: unknown };

      if (typeof interval !== 'number' || interval < 5000 || interval > 600000) {
        res.status(400).json({
          success: false,
          error: 'Interval must be a number between 5000ms (5s) and 600000ms (10m)',
        });
        return;
      }

      (autonomyService as unknown as AutonomyService).setLoopInterval(interval);
      const status = (autonomyService as unknown as AutonomyService).getStatus();

      res.json({
        success: true,
        message: 'Interval updated',
        data: {
          interval: status.interval,
          intervalSeconds: Math.round(status.interval / 1000),
        },
      });
    },
  },
];
