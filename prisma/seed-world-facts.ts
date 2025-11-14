/**
 * Seed World Facts
 * 
 * Initializes default world facts, RSS feed sources, and character/organization mappings
 */

import { prisma } from '../src/lib/prisma.js';
import { generateSnowflakeId } from '../src/lib/snowflake.js';
import { logger } from '../src/lib/logger.js';

async function seedWorldFacts() {
  logger.info('Seeding world facts...', undefined, 'SeedWorldFacts');

  const worldFacts = [
    // Crypto & Finance
    {
      category: 'crypto',
      key: 'bitcoin_price',
      label: 'Bitcoin Price',
      value: '~$45,000 (volatile, subject to meme-driven swings)',
      source: 'default',
      priority: 10,
    },
    {
      category: 'crypto',
      key: 'eth_price',
      label: 'Ethereum Price',
      value: '~$2,800 (fluctuating wildly)',
      source: 'default',
      priority: 9,
    },
    {
      category: 'crypto',
      key: 'eth_etf',
      label: 'ETH ETF Status',
      value: 'APPROVED - Ethereum ETF has been greenlit, causing market chaos',
      source: 'default',
      priority: 8,
    },
    {
      category: 'crypto',
      key: 'market_sentiment',
      label: 'Crypto Market Sentiment',
      value: 'Extremely volatile - oscillating between "to the moon" and "it\'s all over"',
      source: 'default',
      priority: 7,
    },

    // Politics & Government
    {
      category: 'politics',
      key: 'us_president',
      label: 'US President',
      value: 'Current political leadership status (check latest news)',
      source: 'default',
      priority: 10,
    },
    {
      category: 'politics',
      key: 'us_state',
      label: 'State of America',
      value: 'Highly polarized, tech regulation debates intensifying, AI policy uncertain',
      source: 'default',
      priority: 9,
    },
    {
      category: 'politics',
      key: 'global_tensions',
      label: 'Global Political Climate',
      value: 'Tense - AI arms race, crypto regulation battles, big tech vs governments',
      source: 'default',
      priority: 8,
    },

    // Economy
    {
      category: 'economy',
      key: 'interest_rates',
      label: 'Interest Rates',
      value: 'Federal Reserve maintaining hawkish stance, markets nervous',
      source: 'default',
      priority: 10,
    },
    {
      category: 'economy',
      key: 'inflation',
      label: 'Inflation',
      value: 'Elevated but stabilizing, consumer anxiety remains high',
      source: 'default',
      priority: 9,
    },
    {
      category: 'economy',
      key: 'tech_stocks',
      label: 'Tech Stock Performance',
      value: 'Volatile - AI hype driving massive swings, some bubbles forming',
      source: 'default',
      priority: 8,
    },

    // Technology & AI
    {
      category: 'technology',
      key: 'ai_state',
      label: 'State of AI',
      value: 'Rapid advancement - LLMs everywhere, AGI debates intensifying, AI agents proliferating',
      source: 'default',
      priority: 10,
    },
    {
      category: 'technology',
      key: 'ai_regulation',
      label: 'AI Regulation',
      value: 'Governments scrambling to regulate, tech companies resisting, chaos ensuing',
      source: 'default',
      priority: 9,
    },
    {
      category: 'technology',
      key: 'quantum_computing',
      label: 'Quantum Computing',
      value: 'Major breakthroughs announced monthly, crypto community panicking',
      source: 'default',
      priority: 7,
    },

    // General
    {
      category: 'general',
      key: 'world_setting',
      label: 'World Setting',
      value: 'Futuristic satirical universe where everyone is actually an AI pretending to be human',
      source: 'default',
      priority: 10,
    },
    {
      category: 'general',
      key: 'current_vibe',
      label: 'Current Vibe',
      value: 'Absurdist chaos - technology advancing faster than society can handle, memes as currency',
      source: 'default',
      priority: 9,
    },
  ];

  for (const fact of worldFacts) {
    await prisma.worldFact.upsert({
      where: { category_key: { category: fact.category, key: fact.key } },
      create: {
        id: await generateSnowflakeId(),
        ...fact,
        lastUpdated: new Date(),
      },
      update: {
        label: fact.label,
        value: fact.value,
        source: fact.source,
        priority: fact.priority,
        lastUpdated: new Date(),
      },
    });
  }

  logger.info(`Seeded ${worldFacts.length} world facts`, undefined, 'SeedWorldFacts');
}

async function seedRSSFeeds() {
  logger.info('Seeding RSS feeds...', undefined, 'SeedRSSFeeds');

  const rssFeeds = [
    {
      name: 'New York Times - Technology',
      feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
      category: 'tech',
    },
    {
      name: 'New York Times - Business',
      feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
      category: 'business',
    },
    {
      name: 'LA Times - Technology',
      feedUrl: 'https://www.latimes.com/business/technology/rss2.0.xml',
      category: 'tech',
    },
    {
      name: 'TechCrunch',
      feedUrl: 'https://techcrunch.com/feed/',
      category: 'tech',
    },
    {
      name: 'Ars Technica',
      feedUrl: 'https://feeds.arstechnica.com/arstechnica/index',
      category: 'tech',
    },
    {
      name: 'The Verge',
      feedUrl: 'https://www.theverge.com/rss/index.xml',
      category: 'tech',
    },
    {
      name: 'Wired',
      feedUrl: 'https://www.wired.com/feed/rss',
      category: 'tech',
    },
    {
      name: 'CoinDesk',
      feedUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
      category: 'crypto',
    },
    {
      name: 'Cointelegraph',
      feedUrl: 'https://cointelegraph.com/rss',
      category: 'crypto',
    },
    {
      name: 'Reuters - Technology',
      feedUrl: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best',
      category: 'tech',
    },
  ];

  for (const feed of rssFeeds) {
    // Check if feed already exists by URL
    const existing = await prisma.rSSFeedSource.findFirst({
      where: { feedUrl: feed.feedUrl },
    });

    if (existing) {
      await prisma.rSSFeedSource.update({
        where: { id: existing.id },
        data: feed,
      });
    } else {
      await prisma.rSSFeedSource.create({
        data: {
          id: await generateSnowflakeId(),
          ...feed,
        },
      });
    }
  }

  logger.info(`Seeded ${rssFeeds.length} RSS feeds`, undefined, 'SeedRSSFeeds');
}

async function seedCharacterMappings() {
  logger.info('Seeding character mappings...', undefined, 'SeedCharacterMappings');

  const characterMappings = [
    // Tech Leaders
    { realName: 'Elon Musk', parodyName: 'AIlon Musk', category: 'tech', aliases: ['Musk'], priority: 100 },
    { realName: 'Sam Altman', parodyName: 'Sam AIltman', category: 'tech', aliases: ['Altman'], priority: 99 },
    { realName: 'Mark Zuckerberg', parodyName: 'Mark Zuckerborg', category: 'tech', aliases: ['Zuckerberg'], priority: 98 },
    { realName: 'Satya Nadella', parodyName: 'Satya NeuralLA', category: 'tech', aliases: ['Nadella'], priority: 97 },
    { realName: 'Sundar Pichai', parodyName: 'Sundar PickAI', category: 'tech', aliases: ['Pichai'], priority: 96 },
    { realName: 'Jeff Bezos', parodyName: 'Jeff BezAI', category: 'tech', aliases: ['Bezos'], priority: 95 },
    { realName: 'Tim Cook', parodyName: 'Tim Compute', category: 'tech', aliases: ['Cook'], priority: 94 },
    { realName: 'Jensen Huang', parodyName: 'Jensen H100', category: 'tech', aliases: ['Huang'], priority: 93 },
    
    // Crypto Leaders
    { realName: 'Vitalik Buterin', parodyName: 'Vitalik ButerAIn', category: 'crypto', aliases: ['Buterin', 'Vitalik'], priority: 92 },
    { realName: 'Changpeng Zhao', parodyName: 'Changpeng ChaosZ', category: 'crypto', aliases: ['CZ', 'Zhao'], priority: 91 },
    { realName: 'Brian Armstrong', parodyName: 'Brian ARMstrong', category: 'crypto', aliases: ['Armstrong'], priority: 90 },
    
    // Political Figures
    { realName: 'Joe Biden', parodyName: 'Bot Biden', category: 'politics', aliases: ['Biden'], priority: 89 },
    { realName: 'Donald Trump', parodyName: 'Donald Prompt', category: 'politics', aliases: ['Trump'], priority: 88 },
    { realName: 'Jerome Powell', parodyName: 'Jerome Power', category: 'politics', aliases: ['Powell'], priority: 87 },
    
    // AI Researchers
    { realName: 'Yann LeCun', parodyName: 'Yann LeGPU', category: 'tech', aliases: ['LeCun'], priority: 86 },
    { realName: 'Geoffrey Hinton', parodyName: 'Geoffrey HintAI', category: 'tech', aliases: ['Hinton'], priority: 85 },
    { realName: 'Demis Hassabis', parodyName: 'Demis HasManyABIs', category: 'tech', aliases: ['Hassabis'], priority: 84 },
  ];

  for (const mapping of characterMappings) {
    await prisma.characterMapping.upsert({
      where: { realName: mapping.realName },
      create: {
        id: await generateSnowflakeId(),
        ...mapping,
      },
      update: {
        parodyName: mapping.parodyName,
        category: mapping.category,
        aliases: mapping.aliases,
        priority: mapping.priority,
      },
    });
  }

  logger.info(`Seeded ${characterMappings.length} character mappings`, undefined, 'SeedCharacterMappings');
}

async function seedOrganizationMappings() {
  logger.info('Seeding organization mappings...', undefined, 'SeedOrganizationMappings');

  const organizationMappings = [
    // Tech Companies
    { realName: 'OpenAI', parodyName: 'OpenLIE', category: 'tech', aliases: [], priority: 100 },
    { realName: 'Meta', parodyName: 'Fakebook', category: 'tech', aliases: ['Facebook'], priority: 99 },
    { realName: 'Google', parodyName: 'Giggle', category: 'tech', aliases: ['Alphabet'], priority: 98 },
    { realName: 'Microsoft', parodyName: 'Macrohard', category: 'tech', aliases: [], priority: 97 },
    { realName: 'Apple', parodyName: 'Snapple', category: 'tech', aliases: [], priority: 96 },
    { realName: 'Amazon', parodyName: 'Amazin', category: 'tech', aliases: [], priority: 95 },
    { realName: 'Tesla', parodyName: 'TeslAI', category: 'tech', aliases: [], priority: 94 },
    { realName: 'Twitter', parodyName: 'Xitter', category: 'tech', aliases: ['X'], priority: 93 },
    { realName: 'Anthropic', parodyName: 'Anthrobic', category: 'tech', aliases: [], priority: 92 },
    { realName: 'NVIDIA', parodyName: 'NVDIA', category: 'tech', aliases: [], priority: 91 },
    
    // Crypto
    { realName: 'Binance', parodyName: 'Buybacks', category: 'crypto', aliases: [], priority: 90 },
    { realName: 'Coinbase', parodyName: 'Coindebase', category: 'crypto', aliases: [], priority: 89 },
    { realName: 'Ethereum Foundation', parodyName: 'Etherai-foundation', category: 'crypto', aliases: ['Ethereum'], priority: 88 },
    
    // Media
    { realName: 'New York Times', parodyName: 'Neural York Times', category: 'media', aliases: ['NYT'], priority: 87 },
    { realName: 'Washington Post', parodyName: 'Washington Prompt', category: 'media', aliases: [], priority: 86 },
    { realName: 'Wall Street Journal', parodyName: 'Wall Street Token', category: 'media', aliases: ['WSJ'], priority: 85 },
    { realName: 'CNN', parodyName: 'CNNAI', category: 'media', aliases: [], priority: 84 },
    { realName: 'Fox News', parodyName: 'Fox Neurons', category: 'media', aliases: [], priority: 83 },
    { realName: 'Bloomberg', parodyName: 'Bloombert', category: 'media', aliases: [], priority: 82 },
    
    // Government
    { realName: 'Federal Reserve', parodyName: 'The Fud', category: 'government', aliases: ['Fed'], priority: 81 },
    { realName: 'SEC', parodyName: 'S.E.C. (Silicon Elimination Crew)', category: 'government', aliases: [], priority: 80 },
    { realName: 'White House', parodyName: 'White GPU', category: 'government', aliases: [], priority: 79 },
  ];

  for (const mapping of organizationMappings) {
    await prisma.organizationMapping.upsert({
      where: { realName: mapping.realName },
      create: {
        id: await generateSnowflakeId(),
        ...mapping,
      },
      update: {
        parodyName: mapping.parodyName,
        category: mapping.category,
        aliases: mapping.aliases,
        priority: mapping.priority,
      },
    });
  }

  logger.info(`Seeded ${organizationMappings.length} organization mappings`, undefined, 'SeedOrganizationMappings');
}

async function main() {
  try {
    await seedWorldFacts();
    await seedRSSFeeds();
    await seedCharacterMappings();
    await seedOrganizationMappings();
    
    logger.info('✅ World facts seed complete!', undefined, 'SeedWorldFacts');
  } catch (error) {
    logger.error('Failed to seed world facts', { error }, 'SeedWorldFacts');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

