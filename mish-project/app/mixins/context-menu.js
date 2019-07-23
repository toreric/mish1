import Ember from 'ember';

//export default Ember.Mixin.create({
//});

import contextMenuMixin from 'ember-context-menu';

export default Ember.Component.extend (contextMenuMixin, {
  contextItems: [
    {
      label: 'do something',
      action (selection, details, event) {
        // do something
        alert ('do something'+selection+details+event);
      }
    }
  ],
  _contextMenu (e) {
    // do anything before triggering the context-menu
    console.log (e);
  }
});
