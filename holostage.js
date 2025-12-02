/*!
 * HoloStage.js – Free Game for HTML
 */
(function (global) {
  'use strict';

  function parseVec(str, expectedLen, defaults) {
    if (!str) return defaults.slice();
    const parts = String(str)
      .split(',')
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !Number.isNaN(v));
    const out = [];
    for (let i = 0; i < expectedLen; i++) {
      out[i] = parts[i] != null ? parts[i] : (defaults[i] != null ? defaults[i] : 0);
    }
    return out;
  }

  function loadImage(src) {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    return img;
  }

  const keyState = {};
  window.addEventListener('keydown', (e) => {
    keyState[e.key] = true;
  });
  window.addEventListener('keyup', (e) => {
    keyState[e.key] = false;
  });

  function create(canvasOrSelector, options) {
    const canvas =
      typeof canvasOrSelector === 'string'
        ? document.querySelector(canvasOrSelector)
        : canvasOrSelector;

    if (!canvas) {
      throw new Error('HoloStage: Canvas nicht gefunden.');
    }

    const ctx = canvas.getContext('2d');

    const opts = Object.assign(
      {
        pixelScale: 4,
        gravity: 0,
        cameraFollow: null,
        background: '#000000',
        debug: false
      },
      options || {}
    );

    const game = {
      canvas,
      ctx,
      options: opts,
      scenes: {},
      currentScene: null,
      running: false,
      lastTime: 0,
      camera: { x: 0, y: 0 },

      scene(name, builderFn) {
        const scene = createEmptyScene(name, game);
        if (typeof builderFn === 'function') {
          builderFn(scene);
        }
        game.scenes[name] = scene;
        return scene;
      },

      loadSceneFromDOM(selector) {
        const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!root) {
          throw new Error('HoloStage: DOM-Szene nicht gefunden: ' + selector);
        }

        const name = root.id || 'domScene';
        const scene = createEmptyScene(name, game);

        const bg = root.getAttribute('data-hs-background');
        if (bg) scene.background = bg;

        const entityNodes = root.querySelectorAll('[data-hs-entity]');
        entityNodes.forEach((el) => {
          const entName = el.getAttribute('data-hs-entity') || 'entity';
          const pos = parseVec(el.getAttribute('data-hs-pos'), 3, [0, 0, 0]);
          const size = parseVec(el.getAttribute('data-hs-size'), 2, [1, 1]);
          const color = el.getAttribute('data-hs-color') || '#ffffff';
          const spriteSrc = el.getAttribute('data-hs-sprite');
          const physics = el.getAttribute('data-hs-physics') || 'none';
          const controls = el.getAttribute('data-hs-controls') || null;

          scene.addEntity({
            name: entName,
            pos,
            size,
            color,
            sprite: spriteSrc ? loadImage(spriteSrc) : null,
            physics,
            controls
          });
        });

        game.scenes[name] = scene;
        game.currentScene = scene;
        return scene;
      },

      useScene(name) {
        const scene = game.scenes[name];
        if (!scene) {
          throw new Error('HoloStage: Szene nicht gefunden: ' + name);
        }
        game.currentScene = scene;
      },

      ui: {
        text(content, { x = 10, y = 20, font = '16px monospace', color = '#ffffff' } = {}) {
          ctx.save();
          ctx.font = font;
          ctx.fillStyle = color;
          ctx.textBaseline = 'top';
          ctx.fillText(content, x, y);
          ctx.restore();
        }
      },
      start() {
        game.running = true;
        game.lastTime = performance.now();
        requestAnimationFrame(loop);
      },

      stop() {
        game.running = false;
      }
    };

    function createEmptyScene(name, gameRef) {
      const scene = {
        name,
        background: gameRef.options.background,
        entities: [],
        timelineEvents: [],

        addEntity(config) {
          const ent = Object.assign(
            {
              name: 'entity',
              pos: [0, 0, 0], // x, y, z
              size: [1, 1],   // w, h 
              color: '#ffffff',
              sprite: null,
              physics: 'none',   // 'none' | 'dynamic' | 'static'
              controls: null,    // 'arrows'
              vx: 0,
              vy: 0
            },
            config || {}
          );
          scene.entities.push(ent);
          return ent;
        },

        at(t, fn) {
          scene.timelineEvents.push({ time: t, fn, fired: false });
          return scene;
        }
      };
      return scene;
    }

    function loop(now) {
      if (!game.running) return;

      const dt = (now - game.lastTime) / 1000; // Sekunden
      game.lastTime = now;

      update(dt);
      render();

      requestAnimationFrame(loop);
    }

    function update(dt) {
      const scene = game.currentScene;
      if (!scene) return;

      const px = 16 * game.options.pixelScale;

      scene.time = (scene.time || 0) + dt;
      scene.timelineEvents.forEach((evt) => {
        if (!evt.fired && scene.time >= evt.time) {
          evt.fired = true;
          try {
            evt.fn();
          } catch (e) {
            console.error('HoloStage: Fehler in Timeline-Event', e);
          }
        }
      });

      scene.entities.forEach((ent) => {
        // Controls: "arrows"
        if (ent.controls === 'arrows') {
          const speed = 4; 
          let vx = 0;
          let vy = 0;
          if (keyState['ArrowLeft']) vx -= speed;
          if (keyState['ArrowRight']) vx += speed;
          if (keyState['ArrowUp']) vy -= speed;
          if (keyState['ArrowDown']) vy += speed;
          ent.vx = vx;
          ent.vy = vy;
        }

        if (ent.physics === 'dynamic') {
          ent.vy += game.options.gravity * dt;
        }

        ent.pos[0] += ent.vx * dt;
        ent.pos[1] += ent.vy * dt;

        if (ent.physics === 'dynamic') {
          const groundY = 10;
          if (ent.pos[1] > groundY) {
            ent.pos[1] = groundY;
            ent.vy = 0;
          }
        }
      });

      if (game.options.cameraFollow) {
        const followName = game.options.cameraFollow;
        const target = scene.entities.find((e) => e.name === followName);
        if (target) {
          game.camera.x = target.pos[0] * px - canvas.width / 2;
          game.camera.y = target.pos[1] * px - canvas.height / 2;
        }
      }
    }

    // Render-Logik
    function render() {
      const scene = game.currentScene;
      if (!scene) return;

      const { ctx, canvas } = game;
      const px = 16 * game.options.pixelScale;

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      ctx.save();
      ctx.fillStyle = scene.background || game.options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      const ents = scene.entities.slice().sort((a, b) => a.pos[2] - b.pos[2]);

      ents.forEach((ent) => {
        const [x, y, z] = ent.pos;
        const [w, h] = ent.size;

        const screenX = x * px - game.camera.x;
        const screenY = y * px - game.camera.y;
        const screenW = w * px;
        const screenH = h * px;

        ctx.save();

        const zOffsetY = -z * (px * 0.2);
        ctx.translate(0, zOffsetY);

        if (ent.sprite && ent.sprite.complete) {
          ctx.drawImage(ent.sprite, screenX, screenY, screenW, screenH);
        } else {
          ctx.fillStyle = ent.color || '#ffffff';
          ctx.fillRect(screenX, screenY, screenW, screenH);
        }

        // Debug-Hitbox
        if (game.options.debug) {
          ctx.strokeStyle = '#ff00ff';
          ctx.strokeRect(screenX, screenY, screenW, screenH);
        }

        ctx.restore();
      });
    }

    return game;
  }

  // Public API
  const HoloStage = {
    create
  };

  global.HoloStage = HoloStage;
})(typeof window !== 'undefined' ? window : this);
