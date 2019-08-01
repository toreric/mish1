/* eslint-disable no-console */
//import Ember from 'ember';
import Component from '@ember/component';
import contextMenuMixin from 'ember-context-menu';

export default Component.extend (contextMenuMixin, {
  contextItems: () => {return [
    {
      label: 'do something',
      action (selection, details, event) {
        // do something
        alert ('do something'+selection+details+event);
      }
    }
  ]},
  _contextMenu (e) {
    // do anything before triggering the context-menu
    console.log (e);
  }
});
