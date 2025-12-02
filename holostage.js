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

  function parseBool(val, defaultValue = false) {
    if (val == null) return defaultValue;
    const normalized = String(val).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
  }

  function loadImage(src) {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    return img;
  }

  const keyState = {};
  const keysJustPressed = new Set();

  window.addEventListener('keydown', (e) => {
    keyState[e.key] = true;
    keysJustPressed.add(e.key);
  });
  window.addEventListener('keyup', (e) => {
    keyState[e.key] = false;
  });

  const CONTROL_SCHEMES = {
    arrows: {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      up: 'ArrowUp',
      down: 'ArrowDown',
      jump: ' ',
      attack: 'Control'
    },
    wasd: {
      left: 'a',
      right: 'd',
      up: 'w',
      down: 's',
      jump: ' ',
      attack: 'f'
    },
    ijkl: {
      left: 'j',
      right: 'l',
      up: 'i',
      down: 'k',
      jump: 'u',
      attack: 'o'
    }
  };

  function parseProps(str) {
    if (!str) return {};
    return String(str)
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .reduce((acc, part) => {
        const [k, v] = part.split(/[:=]/).map((s) => s && s.trim());
        if (k) acc[k] = v || true;
        return acc;
      }, {});
  }

  function parseControls(str) {
    if (!str) return null;
    const trimmed = String(str).trim();
    if (CONTROL_SCHEMES[trimmed]) {
      return Object.assign({}, CONTROL_SCHEMES[trimmed]);
    }
    const parsed = parseProps(trimmed);
    const map = {};
    ['left', 'right', 'up', 'down', 'jump', 'attack', 'sprint'].forEach((a) => {
      if (parsed[a]) map[a] = parsed[a];
    });
    return Object.keys(map).length ? map : null;
  }

  function parseWeaponDefinitions(str) {
    if (!str) return {};
    return String(str)
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce((acc, entry) => {
        const [name, props] = entry.split(/[:=]/);
        if (!name) return acc;
        acc[name.trim()] = parseProps(props || '');
        return acc;
      }, {});
  }

  function resolveWeaponSpec(spec, definitions) {
    if (!spec) return null;
    const trimmed = String(spec).trim();
    if (definitions && definitions[trimmed]) {
      return Object.assign({ name: trimmed }, definitions[trimmed]);
    }
    const parsed = typeof spec === 'string' ? parseProps(spec) : spec;
    if (parsed.preset && definitions && definitions[parsed.preset]) {
      return Object.assign({ name: parsed.preset }, definitions[parsed.preset], parsed);
    }
    return parsed;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

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
        debug: false,
        multiplayer: true,
        weaponDefine: true,
        weaponDefinitions: {
          pulse: {
            name: 'Pulse',
            damage: 10,
            cooldown: 0.4,
            projectileSpeed: 12,
            color: '#ff6ad5',
            size: [0.3, 0.3]
          },
          bow: {
            name: 'Bow',
            damage: 8,
            cooldown: 0.65,
            projectileSpeed: 11,
            color: '#8ddcff',
            size: [0.25, 0.25]
          },
          pistol: {
            name: 'Pistol',
            damage: 14,
            cooldown: 0.25,
            projectileSpeed: 18,
            color: '#ffd166',
            size: [0.22, 0.22]
          }
        }
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
      scoreboard: null,

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

        scene.multiplayer = parseBool(root.getAttribute('data-hs-multiplayer'), game.options.multiplayer);
        const weaponDefAttr = root.getAttribute('data-hs-weapons');
        scene.weaponDefinitions = parseWeaponDefinitions(weaponDefAttr);

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
          const controls = parseControls(el.getAttribute('data-hs-controls'));
          const moveMode = el.getAttribute('data-hs-move') || 'platformer';
          const team = el.getAttribute('data-hs-team') || null;
          const health = parseFloat(el.getAttribute('data-hs-health')) || 100;
          const speed = parseFloat(el.getAttribute('data-hs-speed')) || 4;
          const jumpForce = parseFloat(el.getAttribute('data-hs-jump')) || 10;
          const weaponAttr = el.getAttribute('data-hs-weapon');
          const weapon = weaponAttr
            ? resolveWeaponSpec(
                weaponAttr,
                Object.assign({}, game.options.weaponDefinitions, scene.weaponDefinitions)
              )
            : undefined;
          const trackScore = el.getAttribute('data-hs-scoreboard') === 'true';

          scene.addEntity({
            name: entName,
            pos,
            size,
            color,
            sprite: spriteSrc ? loadImage(spriteSrc) : null,
            physics,
            controls,
            moveMode,
            team,
            health,
            maxHealth: health,
            speed,
            jumpForce,
            weapon,
            trackScore
          });
        });

        game.scenes[name] = scene;
        game.currentScene = scene;
        // Optional scoreboard UI placeholder inside the DOM scene
        const scoreboardEl = root.querySelector('[data-hs-scoreboard-ui], scoreboard');
        if (scoreboardEl) {
          const heading = scoreboardEl.getAttribute('data-hs-heading') || scoreboardEl.getAttribute('title');
          const className =
            scoreboardEl.getAttribute('data-hs-classname') ||
            (scoreboardEl.className ? scoreboardEl.className.trim() : 'hs-scoreboard');
          game.createScoreboard({ element: scoreboardEl, heading, className });
        }

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
      createScoreboard({
        container = document.body,
        className = 'hs-scoreboard',
        heading = 'Scoreboard',
        element = null
      } = {}) {
        const el = element || document.createElement('div');
        const baseClassName = (className || el.className || 'hs-scoreboard')
          .split(/\s+/)
          .filter(Boolean)[0] || 'hs-scoreboard';
        el.classList.add(baseClassName);
        const ensure = (selector, buildFn) => {
          let node = el.querySelector(selector);
          if (!node) {
            node = buildFn();
            el.appendChild(node);
          }
          return node;
        };

        const title = ensure(`.${baseClassName}__title`, () => {
          const node = document.createElement('div');
          node.className = `${baseClassName}__title`;
          return node;
        });
        title.textContent = heading;

        const list = ensure(`.${baseClassName}__list`, () => {
          const node = document.createElement('div');
          node.className = `${baseClassName}__list`;
          return node;
        });

        if (!element) {
          container.appendChild(el);
        }
        game.scoreboard = {
          element: el,
          list,
          update(players) {
            list.innerHTML = '';
            players
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .forEach((p) => {
                const row = document.createElement('div');
                row.className = `${baseClassName}__row`;
                row.innerHTML = `
                  <span class="${baseClassName}__name">${p.name}</span>
                  <span class="${baseClassName}__team">${p.team || 'solo'}</span>
                  <span class="${baseClassName}__health">❤ ${Math.max(0, Math.round(p.health || 0))}</span>
                  <span class="${baseClassName}__score">${p.score || 0}</span>
                `;
                list.appendChild(row);
              });
          }
        };
        return game.scoreboard;
      },

      registerWeapon(name, config) {
        if (!name || typeof config !== 'object') return;
        game.options.weaponDefinitions = game.options.weaponDefinitions || {};
        game.options.weaponDefinitions[name] = clone(config);
        return game.options.weaponDefinitions[name];
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
              vy: 0,
              speed: 4,
              jumpForce: 10,
              onGround: false,
              moveMode: 'platformer',
              team: null,
              health: 100,
              maxHealth: 100,
              score: 0,
              weapon: {
                name: 'pulse',
                damage: 10,
                cooldown: 0.4,
                projectileSpeed: 12,
                color: '#ff6ad5',
                size: [0.3, 0.3]
              },
              trackScore: false,
              lastAttack: 0,
              kind: 'actor'
            },
            config || {}
          );
          if (typeof ent.controls === 'string') {
            ent.controls = parseControls(ent.controls);
          }
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

      const dynamics = scene.entities.filter((e) => e.physics === 'dynamic');
      const statics = scene.entities.filter((e) => e.physics === 'static');

      scene.entities.forEach((ent) => {
        ent.onGround = false;
        const controls = ent.controls;
        if (controls) {
          const speed = ent.speed || 4;
          let vx = 0;
          let vy = ent.moveMode === 'topdown' || ent.physics === 'none' ? 0 : ent.vy;

          if (controls.left && keyState[controls.left]) vx -= speed;
          if (controls.right && keyState[controls.right]) vx += speed;
          if (controls.up && (ent.moveMode === 'topdown' || ent.physics === 'none') && keyState[controls.up]) vy -= speed;
          if (controls.down && (ent.moveMode === 'topdown' || ent.physics === 'none') && keyState[controls.down]) vy += speed;

          if (controls.jump && keyState[controls.jump] && ent.physics === 'dynamic' && ent.onGround) {
            ent.vy = -ent.jumpForce;
            ent.onGround = false;
          }

          ent.vx = vx;
          ent.vy = vy;

          if (controls.attack && keyState[controls.attack]) {
            tryAttack(ent, scene, dt);
          }
        }

        if (ent.physics === 'dynamic') {
          ent.vy += game.options.gravity * dt;
        }

        const prevX = ent.pos[0];
        const prevY = ent.pos[1];

        ent.pos[0] += ent.vx * dt;
        ent.pos[1] += ent.vy * dt;

        if (ent.physics === 'dynamic') {
          statics.forEach((obstacle) => {
            if (obstacle === ent) return;
            resolveCollision(ent, obstacle);
          });
        }

        if (ent.kind === 'projectile') {
          ent.life = (ent.life || 0) - dt;
          if (ent.life <= 0) ent.dead = true;
        }

        if (Number.isFinite(ent.health) && ent.health <= 0 && !ent.dead) {
          ent.dead = true;
        }

        if (ent.dead && ent.kind === 'projectile') return;
        if (ent.dead && ent.kind !== 'projectile') {
          ent.pos[0] = prevX;
          ent.pos[1] = prevY;
        }
      });

      if (scene.multiplayer !== false && game.options.multiplayer !== false) {
        handlePvp(scene);
      }

      scene.entities = scene.entities.filter((e) => !e.dead);

      if (game.scoreboard) {
        const players = scene.entities.filter((e) => e.trackScore);
        game.scoreboard.update(players);
      }

      keysJustPressed.clear();

      if (game.options.cameraFollow) {
        const followName = game.options.cameraFollow;
        const target = scene.entities.find((e) => e.name === followName);
        if (target) {
          game.camera.x = target.pos[0] * px - canvas.width / 2;
          game.camera.y = target.pos[1] * px - canvas.height / 2;
        }
      }
    }

    function tryAttack(ent, scene, dt) {
      if (!ent.weapon) return;
      const weapon = Object.assign(
        {},
        game.options.defaultWeapon || {},
        resolveWeaponSpec(ent.weapon, game.options.weaponDefinitions)
      );
      const now = performance.now() / 1000;
      const cooldown = parseFloat(weapon.cooldown);
      if (now - (ent.lastAttack || 0) < (Number.isFinite(cooldown) ? cooldown : 0.2)) return;
      ent.lastAttack = now;

      const dir = ent.vx >= 0 ? 1 : -1;
      const damage = Number.isFinite(parseFloat(weapon.damage)) ? parseFloat(weapon.damage) : 10;
      const projectileSpeed = Number.isFinite(parseFloat(weapon.projectileSpeed))
        ? parseFloat(weapon.projectileSpeed)
        : 10;
      const size = Array.isArray(weapon.size)
        ? weapon.size
        : weapon.size
          ? String(weapon.size)
              .split(',')
              .map((s) => parseFloat(s.trim()))
              .filter((n) => !Number.isNaN(n))
          : null;
      const proj = scene.addEntity({
        name: `${ent.name}-shot-${Math.random().toString(16).slice(2, 6)}`,
        pos: [ent.pos[0] + (dir > 0 ? ent.size[0] : -0.2), ent.pos[1] + ent.size[1] / 2, ent.pos[2]],
        size: size && size.length === 2 ? size : [0.3, 0.3],
        color: weapon.color || '#ff6ad5',
        physics: 'none',
        controls: null,
        vx: projectileSpeed * dir,
        vy: 0,
        damage,
        owner: ent.name,
        team: ent.team,
        kind: 'projectile',
        life: 3
      });
      proj.vy = 0;
    }

    function resolveCollision(dynamicEnt, staticEnt) {
      const ax1 = dynamicEnt.pos[0];
      const ay1 = dynamicEnt.pos[1];
      const ax2 = dynamicEnt.pos[0] + dynamicEnt.size[0];
      const ay2 = dynamicEnt.pos[1] + dynamicEnt.size[1];

      const bx1 = staticEnt.pos[0];
      const by1 = staticEnt.pos[1];
      const bx2 = staticEnt.pos[0] + staticEnt.size[0];
      const by2 = staticEnt.pos[1] + staticEnt.size[1];

      const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
      const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

      if (overlapX <= 0 || overlapY <= 0) return;

      if (overlapX < overlapY) {
        if (ax1 < bx1) {
          dynamicEnt.pos[0] -= overlapX;
        } else {
          dynamicEnt.pos[0] += overlapX;
        }
        dynamicEnt.vx = 0;
      } else {
        if (ay1 < by1) {
          dynamicEnt.pos[1] -= overlapY;
          dynamicEnt.onGround = true;
        } else {
          dynamicEnt.pos[1] += overlapY;
        }
        dynamicEnt.vy = 0;
      }
    }

    function handlePvp(scene) {
      const actors = scene.entities.filter((e) => e.kind !== 'projectile');
      const projectiles = scene.entities.filter((e) => e.kind === 'projectile');

      projectiles.forEach((proj) => {
        actors.forEach((actor) => {
          if (actor.name === proj.owner) return;
          if (proj.team && actor.team && proj.team === actor.team) return;
          if (checkOverlap(proj, actor)) {
            actor.health -= proj.damage || 0;
            const owner = scene.entities.find((e) => e.name === proj.owner);
            if (owner) owner.score = (owner.score || 0) + (proj.damage || 0);
            proj.dead = true;
          }
        });
      });

      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          const a = actors[i];
          const b = actors[j];
          if (a.team && b.team && a.team === b.team) continue;
          if (checkOverlap(a, b)) {
            const contactDamage = 5;
            a.health -= contactDamage;
            b.health -= contactDamage;
          }
        }
      }
    }

    function checkOverlap(a, b) {
      const ax1 = a.pos[0];
      const ay1 = a.pos[1];
      const ax2 = a.pos[0] + a.size[0];
      const ay2 = a.pos[1] + a.size[1];
      const bx1 = b.pos[0];
      const by1 = b.pos[1];
      const bx2 = b.pos[0] + b.size[0];
      const by2 = b.pos[1] + b.size[1];

      return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
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
