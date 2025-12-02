# HoloStage.js

A minimal HTML-first game engine for the browser.
Lightweight, dependency-free, and embeddable via a single `<script>` tag.

HoloStage.js allows you to describe entire game scenes directly in HTML using `data-hs-*` attributes. The engine parses the DOM, converts elements into game entities, and renders everything on a canvas. You can also define scenes programmatically through a simple API.

---

## Features

* Zero-config, one-file engine
* HTML-driven scene definition (DOM → Game World)
* 2D rendering with subtle 2.5D depth effects
* Retro pixel scaling
* Built-in input control module (arrow keys, etc.)
* Lightweight physics (gravity, velocity, static/dynamic bodies)
* Platformer jump physics and directional control maps (`arrows`, `wasd`, `ijkl` or custom mappings)
* Timeline events (`scene.at(time, fn)`)
* Camera follow system
* Debug mode with hitbox display
* PvP-friendly mechanics: projectiles, collision damage, teams, and scores
* Drop-in scoreboard UI that is pure HTML/CSS for easy theming

---

## Install via CDN

Use jsDelivr to load the engine directly from your GitHub repository:

### Versioned:

```html
<script src="https://cdn.jsdelivr.net/gh/ukyyyy/holostage@v1.0.0/game.js"></script>
```

### Latest commit:

```html
<script src="https://cdn.jsdelivr.net/gh/ukyyyy/holostage/game.js"></script>
```

---

## Minimal Example (HTML-defined Scene)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HoloStage Demo</title>
  <style>
    body { margin: 0; background: #111; }
    #game { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>

  <div id="level1"
       data-hs-scene
       data-hs-background="#202838">

    <div data-hs-entity="player"
         data-hs-color="#4af"
         data-hs-pos="2,2,0"
         data-hs-size="1,1"
         data-hs-controls="arrows"
         data-hs-physics="dynamic">
    </div>

    <div data-hs-entity="ground"
         data-hs-color="#444"
         data-hs-pos="0,10,0"
         data-hs-size="20,1"
         data-hs-physics="static">
    </div>

  </div>

  <canvas id="game"></canvas>

  <script src="https://cdn.jsdelivr.net/gh/ukyyyy/holostage@v1.0.0/game.js"></script>

  <script>
    const game = HoloStage.create('#game', {
      pixelScale: 4,
      gravity: 15,
      cameraFollow: 'player',
      debug: true
    });

    game.loadSceneFromDOM('#level1');
    game.start();
  </script>

</body>
</html>
```

---

## API Overview

### HoloStage.create(canvas, options)

Creates a new game instance.

**Useful Options:**

| Option         | Description                                |
| -------------- | ------------------------------------------ |
| `pixelScale`   | Pixel scaling factor (default: 4)          |
| `gravity`      | World gravity in px/s                      |
| `cameraFollow` | Name of an entity the camera should follow |
| `debug`        | Draws hitboxes and debug info              |

---

### Load scenes from HTML

```js
game.loadSceneFromDOM('#level1');
```

Entities are automatically created using attributes like:

```
data-hs-entity
data-hs-pos
data-hs-size
data-hs-color
data-hs-sprite
data-hs-controls
data-hs-physics
data-hs-speed
data-hs-jump
data-hs-team
data-hs-weapon
data-hs-scoreboard
```

---

### Programmatic scene creation

```js
const scene = game.scene('test', ({ add }) => {
  add.entity({
    name: 'player',
    pos: [1, 1, 0],
    size: [1, 1],
    color: '#4af',
    controls: 'arrows',
    physics: 'dynamic'
  });
});
game.useScene('test');
```

---

### Entity configuration fields

| Field      | Description                 |
| ---------- | --------------------------- |
| `name`     | Unique identifier           |
| `pos`      | `[x, y, z]` position        |
| `size`     | `[width, height]` size      |
| `color`    | Fallback color              |
| `sprite`   | Image object                |
| `physics`  | `none`, `static`, `dynamic` |
| `controls` | `arrows` for keyboard input |
| `speed`    | Horizontal move speed       |
| `jump`     | Jump impulse for platformers|
| `team`     | Optional team label         |
| `weapon`   | `name:Pulse;damage:12` etc. |
| `scoreboard`| `true` to track on the HUD |

### PvP, Weapons & Scoreboard

* **Controls** – use `arrows`, `wasd`, `ijkl`, or a custom map such as `left=a,right=d,jump=Space,attack=f`.
* **Weapons** – attach `data-hs-weapon="name:Laser;damage:14;projectileSpeed:15;color:#ff89c9"` to spawn colored projectiles with per-entity cooldowns.
* **Teams** – add `data-hs-team="red"` or `data-hs-team="blue"` to prevent friendly fire and organize the scoreboard.
* **Scoreboard** – call `game.createScoreboard({ heading: 'Arena' })` after `loadSceneFromDOM`. The HUD is plain HTML (`.hs-scoreboard` classes) so you can restyle it with your own CSS.

---

### Timeline events

```js
scene.at(5, () => {
  console.log('5 seconds elapsed');
});
```
