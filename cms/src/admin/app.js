import { migratePublicationColumns } from './publication-columns.mjs';

export default {
  config: {
    locales: ['fr'],
  },
  bootstrap() {
    migratePublicationColumns(window.localStorage);
  },
};
