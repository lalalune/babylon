/**
 * React hook for A2A protocol utilities
 * 
 * Provides access to both custom Babylon methods and official A2A protocol
 */

export const useA2A = () => {
  return {
    // Placeholder for future A2A utilities
    // Could include: task subscriptions, streaming hooks, etc.
    debug: () => {
      console.log('A2A utilities available')
      console.log('Custom methods: /api/a2a (58 methods)')
      console.log('A2A: /api/a2a (message/send)')
    },
  };
};
