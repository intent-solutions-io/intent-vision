/**
 * OpenAPI Specification Validator
 *
 * Phase 19: Developer Experience - OpenAPI, SDK, and Sandbox Keys
 *
 * Validates the OpenAPI specification file for correctness and completeness.
 * Run with: npx tsx src/scripts/validate-openapi.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateOpenApiSpec(content: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check for required OpenAPI fields
  const requiredFields = [
    'openapi:',
    'info:',
    'paths:',
    'components:',
    'security:',
  ];

  for (const field of requiredFields) {
    if (!content.includes(field)) {
      result.errors.push(`Missing required field: ${field}`);
      result.valid = false;
    }
  }

  // Check for required paths
  const requiredPaths = [
    '/v1/events:',
    '/v1/metrics/{metricName}/forecasts:',
    '/v1/forecast/run:',
    '/v1/alerts:',
  ];

  for (const path of requiredPaths) {
    if (!content.includes(path)) {
      result.errors.push(`Missing required path: ${path}`);
      result.valid = false;
    }
  }

  // Check for security schemes
  if (!content.includes('ApiKeyAuth:')) {
    result.errors.push('Missing ApiKeyAuth security scheme');
    result.valid = false;
  }

  // Check for required schemas
  const requiredSchemas = [
    'IngestEventRequest:',
    'IngestEventResponse:',
    'RunForecastRequest:',
    'RunForecastResponse:',
    'CreateAlertRuleRequest:',
    'AlertRule:',
    'ErrorResponse:',
  ];

  for (const schema of requiredSchemas) {
    if (!content.includes(schema)) {
      result.errors.push(`Missing required schema: ${schema}`);
      result.valid = false;
    }
  }

  // Check for HTTP methods
  const httpMethods = ['get:', 'post:', 'patch:', 'delete:'];
  let methodCount = 0;
  for (const method of httpMethods) {
    const matches = content.match(new RegExp(method, 'g'));
    if (matches) {
      methodCount += matches.length;
    }
  }

  if (methodCount < 5) {
    result.warnings.push(
      `Low number of HTTP methods defined (${methodCount}). Expected at least 5.`
    );
  }

  // Check for examples
  if (!content.includes('examples:')) {
    result.warnings.push('No examples found in specification');
  }

  // Check for response codes
  const responseCodes = ["'200':", "'201':", "'400':", "'401':", "'404':", "'429':"];
  for (const code of responseCodes) {
    if (!content.includes(code)) {
      result.warnings.push(`No ${code} response code found`);
    }
  }

  // Check version
  if (!content.includes('openapi: 3.0')) {
    result.errors.push('Specification must use OpenAPI 3.0 format');
    result.valid = false;
  }

  return result;
}

async function main() {
  console.log('OpenAPI Specification Validator');
  console.log('================================\n');

  const specPath = resolve(process.cwd(), 'openapi.yaml');

  try {
    console.log(`Reading specification from: ${specPath}\n`);
    const content = readFileSync(specPath, 'utf-8');

    console.log('Validating OpenAPI specification...\n');
    const result = validateOpenApiSpec(content);

    // Display errors
    if (result.errors.length > 0) {
      console.log('ERRORS:');
      for (const error of result.errors) {
        console.log(`  ✗ ${error}`);
      }
      console.log('');
    }

    // Display warnings
    if (result.warnings.length > 0) {
      console.log('WARNINGS:');
      for (const warning of result.warnings) {
        console.log(`  ⚠ ${warning}`);
      }
      console.log('');
    }

    // Display summary
    console.log('SUMMARY:');
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);
    console.log('');

    if (result.valid) {
      console.log('✓ OpenAPI specification is valid');
      process.exit(0);
    } else {
      console.log('✗ OpenAPI specification has errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error validating specification:', (error as Error).message);
    process.exit(1);
  }
}

main();
