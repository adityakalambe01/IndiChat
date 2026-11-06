import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  // Mock external boundaries
  if (
    specifier === '@react-native-async-storage/async-storage' ||
    specifier === 'react-native' ||
    specifier === 'expo-constants' ||
    specifier === 'expo-file-system' ||
    specifier === '@chat/shared-types'
  ) {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.resolve('scripts/mocks/external-mock.mjs')).href,
    };
  }

  // Handle extensionless relative or absolute imports
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const dir = path.dirname(parent);
    const resolvedPath = path.resolve(dir, specifier);
    for (const ext of ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js']) {
      if (fs.existsSync(resolvedPath + ext)) {
        return {
          shortCircuit: true,
          url: pathToFileURL(resolvedPath + ext).href,
        };
      }
    }
  }

  return nextResolve(specifier, context);
}
