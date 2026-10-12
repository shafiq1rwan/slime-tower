import Phaser from 'phaser';

// Global event bus connecting the DOM UI and the Phaser scenes.
// UI -> game:  'ui:play', 'ui:pause', 'ui:resume', 'ui:restart', 'ui:menu', 'ui:upgrade'
// game -> UI:  handled by direct calls on the UI singleton (see ui/UIManager.js)
// misc:        'settings:changed', 'layout:changed'
export const bus = new Phaser.Events.EventEmitter();
