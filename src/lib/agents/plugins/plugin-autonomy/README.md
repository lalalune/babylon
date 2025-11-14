# ElizaOS Autonomy Plugin

A clean, focused autonomy plugin that enables autonomous agent behavior with
admin chat integration.

## Overview

This plugin provides exactly **3 components**:

1. **AutonomyService**: Autonomous loop service that can be controlled via API
2. **adminChatProvider**: Provides conversation history with admin user
   (autonomous context only)
3. **sendToAdminAction**: Allows agent to send messages to admin (autonomous
   context only)

## Components

### AutonomyService

- **Purpose**: Runs an autonomous thinking loop in a dedicated room
- **Controls**: Can be started/stopped and interval can be adjusted (5s - 10m)
- **Persistence**: State is saved in agent settings (AUTONOMY_ENABLED)
- **Room**: Creates dedicated autonomous room for internal thoughts

**Methods:**

- `startLoop()` - Start autonomous thinking
- `stopLoop()` - Stop autonomous thinking
- `setLoopInterval(ms)` - Set thinking interval
- `isLoopRunning()` - Check if running
- `getAutonomousRoomId()` - Get the autonomous room ID

### adminChatProvider

- **Purpose**: Provides recent conversation history with admin user
- **Context**: Only active in autonomous room (validates room ID)
- **Configuration**: Requires `ADMIN_USER_ID` setting
- **Output**: Formatted conversation history for agent context

### sendToAdminAction

- **Purpose**: Allows agent to message admin from autonomous thoughts
- **Validation**: Only works in autonomous room, requires admin configuration
- **Behavior**: Finds admin's room and sends contextual message

## Configuration

Add these settings to your character configuration:

```json
{
  "settings": {
    "ADMIN_USER_ID": "user-uuid-here",
    "AUTONOMY_AUTO_START": true,
    "AUTONOMY_ENABLED": false
  }
}
```

### Settings

- `ADMIN_USER_ID`: UUID of the admin user for chat history and messaging
- `AUTONOMY_AUTO_START`: Whether to start autonomy loop on agent startup
- `AUTONOMY_ENABLED`: Current state of autonomy (managed by service)

## Usage

### Installation

Add to your character's plugins array:

```json
{
  "plugins": ["@elizaos/plugin-autonomy"]
}
```

### Control via Service

```typescript
const autonomyService = runtime.getService('autonomy');

// Start/stop
await autonomyService.startLoop();
await autonomyService.stopLoop();

// Configure
autonomyService.setLoopInterval(60000); // 1 minute
const isRunning = autonomyService.isLoopRunning();
```

## Autonomous Context

The plugin creates a dedicated "autonomous room" where the agent thinks
independently. In this context:

- **Admin chat provider** supplies conversation history for context
- **Send to admin action** becomes available to message the admin
- **Regular channels** don't have these capabilities (prevents misuse)

## Testing

The plugin includes comprehensive tests:

```bash
elizaos test # Runs all plugin tests including autonomy
```

Tests validate:

- Service lifecycle (start/stop/interval)
- Provider context validation (autonomous vs regular rooms)
- Action validation and execution
- Admin configuration requirements

## Architecture

```
Autonomous Loop (30s default)
         ↓
    Autonomous Room
         ↓
   Admin Chat Context ← (Provider)
         ↓
   Agent Thinking/Actions
         ↓
   Send to Admin ← (Action, if needed)
```

The agent continuously thinks in its autonomous room, has access to admin
conversation history for context, and can proactively message the admin when
appropriate.

## Security

- **Context isolation**: Admin features only work in autonomous room
- **Validation**: All components validate context before execution
- **Configuration required**: Admin features require explicit admin user setup
- **Rate limiting**: Built-in interval limits (5s minimum, 10m maximum)
