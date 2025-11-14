#!/usr/bin/env tsx
/**
 * Generate contract ABI documentation
 * Extracts ABIs from compiled contracts and creates documentation
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ABIInput {
  name: string;
  type: string;
  internalType?: string;
  indexed?: boolean;
}

interface ABIOutput {
  name?: string;
  type: string;
  internalType?: string;
}

interface ABIItem {
  type: 'function' | 'constructor' | 'event' | 'error';
  name?: string;
  inputs?: ABIInput[];
  outputs?: ABIOutput[];
  stateMutability?: string;
}

interface ContractABI {
  name: string;
  abi: ABIItem[];
  bytecode?: string;
}

async function* walkDirectory(dir: string, ext: string): AsyncGenerator<string> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDirectory(fullPath, ext);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        yield fullPath;
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }
}

async function loadCompiledContracts(): Promise<ContractABI[]> {
  const contracts: ContractABI[] = [];
  const outDir = path.join(process.cwd(), '../out');
  
  try {
    // Foundry puts compiled contracts in out/ContractName.sol/ContractName.json
    for await (const filePath of walkDirectory(outDir, '.json')) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.abi && Array.isArray(data.abi)) {
          const fileName = path.basename(filePath, '.json');
          contracts.push({
            name: fileName,
            abi: data.abi,
            bytecode: data.bytecode?.object,
          });
        }
      } catch {
        // Skip invalid JSON files
      }
    }
  } catch {
    console.warn('Could not read compiled contracts. Run `forge build` first.');
  }
  
  return contracts;
}

function generateAbiMarkdown(contract: ContractABI): string {
  let md = `# ${contract.name}\n\n`;
  
  // Group ABI by type
  const functions = contract.abi.filter(item => item.type === 'function');
  const events = contract.abi.filter(item => item.type === 'event');
  const errors = contract.abi.filter(item => item.type === 'error');
  const constructor = contract.abi.find(item => item.type === 'constructor');
  
  // Constructor
  if (constructor) {
    md += `## Constructor\n\n`;
    md += `\`\`\`solidity\n`;
    md += `constructor(${constructor.inputs?.map((i) => `${i.type} ${i.name}`).join(', ') || ''})\n`;
    md += `\`\`\`\n\n`;
  }
  
  // Functions
  if (functions.length > 0) {
    md += `## Functions\n\n`;
    
    for (const func of functions) {
      const inputs = func.inputs?.map((i) => `${i.type} ${i.name}`).join(', ') || '';
      const outputs = func.outputs?.map((o) => o.type).join(', ') || 'void';
      const mutability = func.stateMutability || 'nonpayable';
      
      md += `### ${func.name}\n\n`;
      md += `\`\`\`solidity\n`;
      md += `function ${func.name}(${inputs}) ${mutability}`;
      if (outputs !== 'void') {
        md += ` returns (${outputs})`;
      }
      md += `\n\`\`\`\n\n`;
      
      if (func.inputs && func.inputs.length > 0) {
        md += `**Parameters:**\n\n`;
        for (const input of func.inputs) {
          md += `- \`${input.name}\` (\`${input.type}\`)`;
          if (input.internalType) {
            md += ` - ${input.internalType}`;
          }
          md += `\n`;
        }
        md += `\n`;
      }
      
      if (func.outputs && func.outputs.length > 0) {
        md += `**Returns:**\n\n`;
        for (const output of func.outputs) {
          md += `- ${output.type}`;
          if (output.name) {
            md += ` ${output.name}`;
          }
          md += `\n`;
        }
        md += `\n`;
      }
      
      md += `---\n\n`;
    }
  }
  
  // Events
  if (events.length > 0) {
    md += `## Events\n\n`;
    
    for (const event of events) {
      const inputs = event.inputs?.map((i) => 
        `${i.indexed ? 'indexed ' : ''}${i.type} ${i.name}`
      ).join(', ') || '';
      
      md += `### ${event.name}\n\n`;
      md += `\`\`\`solidity\n`;
      md += `event ${event.name}(${inputs})\n`;
      md += `\`\`\`\n\n`;
      
      if (event.inputs && event.inputs.length > 0) {
        md += `**Parameters:**\n\n`;
        for (const input of event.inputs) {
          md += `- \`${input.name}\` (\`${input.type}\`)`;
          if (input.indexed) {
            md += ` - indexed`;
          }
          md += `\n`;
        }
        md += `\n`;
      }
    }
  }
  
  // Errors
  if (errors.length > 0) {
    md += `## Errors\n\n`;
    
    for (const error of errors) {
      const inputs = error.inputs?.map((i) => `${i.type} ${i.name}`).join(', ') || '';
      
      md += `### ${error.name}\n\n`;
      md += `\`\`\`solidity\n`;
      md += `error ${error.name}(${inputs})\n`;
      md += `\`\`\`\n\n`;
    }
  }
  
  // Raw ABI
  md += `## Raw ABI\n\n`;
  md += `<details>\n`;
  md += `<summary>Click to expand</summary>\n\n`;
  md += `\`\`\`json\n`;
  md += JSON.stringify(contract.abi, null, 2);
  md += `\n\`\`\`\n\n`;
  md += `</details>\n\n`;
  
  return md;
}

async function main() {
  console.log('🔍 Loading compiled contracts...\n');
  
  const contracts = await loadCompiledContracts();
  
  if (contracts.length === 0) {
    console.log('⚠ No compiled contracts found. Run `forge build` first.');
    return;
  }
  
  console.log(`📝 Found ${contracts.length} contract(s):\n`);
  for (const c of contracts) {
    console.log(`  ✓ ${c.name}`);
  }
  
  console.log('\n📄 Generating ABI documentation...\n');
  
  const abiDir = path.join(process.cwd(), 'app/contracts/_generated/abis');
  await fs.mkdir(abiDir, { recursive: true });
  
  // Generate individual contract docs
  for (const contract of contracts) {
    const markdown = generateAbiMarkdown(contract);
    const mdPath = path.join(abiDir, `${contract.name}.mdx`);
    await fs.writeFile(mdPath, markdown);
    console.log(`  ✓ Generated docs for ${contract.name}`);
  }
  
  // Generate index
  let indexMd = `# Contract ABIs\n\n`;
  indexMd += `Application Binary Interfaces for all Babylon smart contracts.\n\n`;
  
  for (const contract of contracts.sort((a, b) => a.name.localeCompare(b.name))) {
    indexMd += `- [${contract.name}](./abis/${contract.name})\n`;
  }
  
  const indexPath = path.join(process.cwd(), 'app/contracts/_generated/index.mdx');
  await fs.writeFile(indexPath, indexMd);
  
  // Export ABIs as JSON
  const jsonPath = path.join(process.cwd(), 'public/abis.json');
  await fs.writeFile(jsonPath, JSON.stringify(
    contracts.reduce((acc, c) => {
      acc[c.name] = c.abi;
      return acc;
    }, {} as Record<string, ABIItem[]>),
    null,
    2
  ));
  console.log('  ✓ Exported ABIs as JSON');
  
  console.log('\n✅ Contract ABI documentation generated successfully!');
}

main().catch(console.error);

