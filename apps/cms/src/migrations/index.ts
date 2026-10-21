import * as migration_20261021_121916_initial from './20261021_121916_initial';

export const migrations = [
  {
    up: migration_20261021_121916_initial.up,
    down: migration_20261021_121916_initial.down,
    name: '20261021_121916_initial'
  },
];
