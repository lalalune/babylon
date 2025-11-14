// Quick test to verify column name mapping
import { drizzle } from 'drizzle-orm/pglite';
import { plugin } from '@elizaos/plugin-sql';

console.log('=== Schema Debug ===');
console.log('Plugin schema keys:', Object.keys(plugin.schema || {}));

// Access the componentTable through the plugin schema
const { componentTable, entityTable } = plugin.schema || {};

if (componentTable) {
  console.log('componentTable keys:', Object.keys(componentTable));
  console.log('componentTable.entityId:', componentTable.entityId);

  // Check specific column properties
  const cols = ['entityId', 'agentId', 'roomId', 'sourceEntityId'];
  cols.forEach((col) => {
    if (componentTable[col]) {
      console.log(`\n${col}:`);
      console.log('- name:', componentTable[col].name);
      console.log('- dataType:', componentTable[col].dataType);
      console.log('- config:', componentTable[col].config);
    }
  });
} else {
  console.log('ComponentTable not found in schema');
}
