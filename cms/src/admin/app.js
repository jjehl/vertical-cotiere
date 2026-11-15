import { migratePublicationColumns } from './publication-columns.mjs';
import { memberRoleColumns } from './MemberRoleCell';

export default {
  config: {
    locales: ['fr'],
  },
  bootstrap(app) {
    migratePublicationColumns(window.localStorage);
    app.registerHook('Admin/CM/pages/ListView/inject-column-in-table', memberRoleColumns);
  },
};
