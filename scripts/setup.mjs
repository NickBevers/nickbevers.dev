import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

for (const app of ['cms', 'web']) {
  const directory = new URL(`../apps/${app}/`, import.meta.url);
  const example = await readFile(new URL('.env.example', directory), 'utf8');
  const content = example.replace('replace-with-a-random-secret', randomBytes(32).toString('hex'));

  try {
    await writeFile(new URL('.env', directory), content, { flag: 'wx', mode: 0o600 });
    console.log(`Created apps/${app}/.env`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
