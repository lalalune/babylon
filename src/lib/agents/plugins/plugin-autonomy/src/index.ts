import { type Plugin } from '@elizaos/core';
import { AutonomyService } from './service';
import { adminChatProvider } from './provider';
import { autonomyStatusProvider } from './status-provider';
import { sendToAdminAction } from './action';
import { autonomyRoutes } from './routes';

/**
 * Clean autonomy plugin with settings-based control:
 * 1. Service: Autonomous loop controlled via AUTONOMY_ENABLED setting
 * 2. Admin Chat Provider: Admin history (autonomous context only)
 * 3. Status Provider: Shows autonomy status (regular chat only)
 * 4. Action: Send message to admin (autonomous context only)
 * 5. Routes: API for enable/disable/status
 */
export const autonomyPlugin: Plugin = {
  name: 'autonomy',
  description: 'Clean autonomous loop plugin with settings-based control',

  services: [AutonomyService],
  providers: [adminChatProvider, autonomyStatusProvider],
  actions: [sendToAdminAction],
  routes: autonomyRoutes,
};

// Export components
export { AutonomyService } from './service';
export { adminChatProvider } from './provider';
export { autonomyStatusProvider } from './status-provider';
export { sendToAdminAction } from './action';
export { autonomyRoutes } from './routes';

export default autonomyPlugin;
