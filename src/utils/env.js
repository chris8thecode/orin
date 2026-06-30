import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../../.env');

export function updateEnvFile(key, value) {
  if (!existsSync(envPath)) {
    writeFileSync(envPath, '');
  }

  let content = readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  let found = false;

  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }

  writeFileSync(envPath, updatedLines.join('\n'));
  process.env[key] = value;
}

export function getEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}
