import React from 'react';

const AssistantIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z" stroke="currentColor" strokeWidth="1.6" /></svg>;

export default {
  register(app) {
    app.addMenuLink({
      to: 'plugins/publication-assistant', icon: AssistantIcon,
      intlLabel: { id:'publication-assistant.name', defaultMessage:'Assistant de publication' },
      Component: () => import('./pages/Assistant'),
      permissions: [{action:'plugin::publication-assistant.use',subject:null}],
    });
    app.registerPlugin({ id:'publication-assistant', name:'Assistant de publication' });
  },
};
