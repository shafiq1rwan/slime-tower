import Phaser from 'phaser';
import { generateTextures } from '../art/textures.js';
import { WORLD } from '../config/gameConfig.js';
import { DEBUG } from '../utils/debug.js';
import { ui } from '../ui/UIManager.js';

// Generates all procedural textures, then hands over to the menu.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateTextures(this, WORLD.ARENA_RADIUS);
    ui.hideLoading();
    this.scene.start(DEBUG.skipMenu || DEBUG.auto ? 'Game' : 'Menu');
  }
}
