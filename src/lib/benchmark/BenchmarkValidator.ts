/**
 * Benchmark Data Validator
 * 
 * Validates benchmark snapshot data to ensure it's properly formatted
 * and contains all required fields.
 */

import type { BenchmarkGameSnapshot } from './BenchmarkDataGenerator';
import { logger } from '@/lib/logger';

export interface BenchmarkValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class BenchmarkValidator {
  /**
   * Validate a benchmark snapshot
   */
  static validate(snapshot: any): BenchmarkValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Check required top-level fields
    if (!snapshot) {
      errors.push('Snapshot is null or undefined');
      return { valid: false, errors, warnings };
    }
    
    if (!snapshot.id) errors.push('Missing required field: id');
    if (!snapshot.version) errors.push('Missing required field: version');
    if (typeof snapshot.duration !== 'number') errors.push('Missing or invalid field: duration');
    if (typeof snapshot.tickInterval !== 'number') errors.push('Missing or invalid field: tickInterval');
    if (!snapshot.initialState) errors.push('Missing required field: initialState');
    if (!Array.isArray(snapshot.ticks)) errors.push('Missing or invalid field: ticks (must be array)');
    if (!snapshot.groundTruth) errors.push('Missing required field: groundTruth');
    
    // 2. Validate initial state
    if (snapshot.initialState) {
      const state = snapshot.initialState;
      
      if (typeof state.tick !== 'number') errors.push('initialState.tick must be a number');
      if (state.tick !== 0) warnings.push('initialState.tick should be 0');
      
      if (!Array.isArray(state.predictionMarkets)) {
        errors.push('initialState.predictionMarkets must be an array');
      }
      
      if (!Array.isArray(state.perpetualMarkets)) {
        errors.push('initialState.perpetualMarkets must be an array');
      }
      
      if (!Array.isArray(state.agents)) {
        errors.push('initialState.agents must be an array');
      }
    }
    
    // 3. Validate ticks
    if (Array.isArray(snapshot.ticks)) {
      if (snapshot.ticks.length === 0) {
        warnings.push('Ticks array is empty');
      }
      
      snapshot.ticks.forEach((tick: any, index: number) => {
        if (typeof tick.number !== 'number') {
          errors.push(`Tick ${index}: missing or invalid 'number' field`);
        }
        
        if (!Array.isArray(tick.events)) {
          errors.push(`Tick ${index}: events must be an array`);
        }
        
        if (!tick.state) {
          errors.push(`Tick ${index}: missing state`);
        }
      });
      
      // Check tick numbering is sequential
      for (let i = 0; i < snapshot.ticks.length; i++) {
        if (snapshot.ticks[i].number !== i) {
          warnings.push(`Tick ${i}: number ${snapshot.ticks[i].number} doesn't match index`);
        }
      }
    }
    
    // 4. Validate ground truth
    if (snapshot.groundTruth) {
      const gt = snapshot.groundTruth;
      
      if (!gt.marketOutcomes || typeof gt.marketOutcomes !== 'object') {
        errors.push('groundTruth.marketOutcomes must be an object');
      }
      
      if (!gt.priceHistory || typeof gt.priceHistory !== 'object') {
        errors.push('groundTruth.priceHistory must be an object');
      }
      
      if (!Array.isArray(gt.optimalActions)) {
        errors.push('groundTruth.optimalActions must be an array');
      }
      
      if (!Array.isArray(gt.socialOpportunities)) {
        errors.push('groundTruth.socialOpportunities must be an array');
      }
    }
    
    // 5. Cross-validate: markets in initialState should have outcomes in groundTruth
    if (snapshot.initialState && snapshot.groundTruth) {
      const markets = snapshot.initialState.predictionMarkets || [];
      const outcomes = snapshot.groundTruth.marketOutcomes || {};
      
      markets.forEach((market: any) => {
        if (market.id && !(market.id in outcomes)) {
          warnings.push(`Market ${market.id} in initialState but no outcome in groundTruth`);
        }
      });
    }
    
    logger.info('Benchmark validation complete', {
      valid: errors.length === 0,
      errors: errors.length,
      warnings: warnings.length,
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Quick sanity check (fast, minimal validation)
   */
  static sanityCheck(snapshot: any): boolean {
    return !!(
      snapshot &&
      snapshot.id &&
      snapshot.initialState &&
      Array.isArray(snapshot.ticks) &&
      snapshot.groundTruth
    );
  }
  
  /**
   * Validate and throw if invalid
   */
  static validateOrThrow(snapshot: any): asserts snapshot is BenchmarkGameSnapshot {
    const result = this.validate(snapshot);
    
    if (!result.valid) {
      throw new Error(`Invalid benchmark data: ${result.errors.join(', ')}`);
    }
  }
}

