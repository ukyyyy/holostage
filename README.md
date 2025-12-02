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
* Built-in weapon presets (pulse, bow, pistol) with the ability to define your own presets inline
* Drop-in scoreboard UI that is pure HTML/CSS for easy theming or binding to a custom `<scoreboard>` element

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

| Option              | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `pixelScale`        | Pixel scaling factor (default: 4)                                           |
| `gravity`           | World gravity in px/s                                                       |
| `cameraFollow`      | Name of an entity the camera should follow                                  |
| `debug`             | Draws hitboxes and debug info                                               |
| `multiplayer`       | Enables PvP collisions and scoring (default: `true`)                        |
| `weaponDefine`      | Keeps built-in weapon presets active (default: `true`)                      |
| `weaponDefinitions` | Object map of weapon presets you can extend (defaults: `pulse`, `bow`, `pistol`) |

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
data-hs-multiplayer
data-hs-weapons
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
| `multiplayer` | Scene-level toggle to keep PvP logic on/off |
| `weapons`  | Define custom presets at the scene root using `data-hs-weapons` |

### PvP, Weapons & Scoreboard

* **Controls** – use `arrows`, `wasd`, `ijkl`, or a custom map such as `left=a,right=d,jump=Space,attack=f`.
* **Weapons** – attach `data-hs-weapon="bow"` to use the built-in bow preset or override with `data-hs-weapon="name:Laser;damage:14;projectileSpeed:15;color:#ff89c9"`. Add scene-wide presets via `data-hs-weapons="bow:damage=9,cooldown=0.6 | pistol:damage=14,cooldown=0.25"` on the scene container.
* **Teams** – add `data-hs-team="red"` or `data-hs-team="blue"` to prevent friendly fire and organize the scoreboard.
* **Scoreboard** – call `game.createScoreboard({ heading: 'Arena', className: 'my-board' })` or place a `<scoreboard data-hs-scoreboard-ui data-hs-heading="Arena" data-hs-classname="my-board"></scoreboard>` inside the scene container. The HUD is plain HTML (`.hs-scoreboard` classes by default) so you can restyle it with your own CSS.

---

### Timeline events

```js
scene.at(5, () => {
  console.log('5 seconds elapsed');
});
```

---

## Development & Build

HoloStage.js is a **single-file project**.
No build tools, transpilers, or bundlers required.

---

## Deploying to GitHub

### 1. Create the repository

Create a new public GitHub repo named `holostage`.

### 2. Add the engine file

```bash
git clone https://github.com/ukyyyy/holostage.git
cd holostage
cp path/to/game.js ./game.js

git add game.js
git commit -m "Initial engine"
git push
```

### 3. Create a version tag (recommended for CDN)

```bash
git tag v1.0.0
git push origin v1.0.0
```

Now your CDN URL will work:

```
https://cdn.jsdelivr.net/gh/ukyyyy/holostage@v1.0.0/game.js
```

---

## GitHub Pages Demo (Optional)

If you want a public demo page:

1. In the repo, go to Settings → Pages
2. Select:

   * Branch: `main`
   * Folder: `/root`
3. Add an `index.html` demo

Your demo will be visible at:

```
https://ukyyyy.github.io/holostage/
```

---

## License

Choose any license you prefer (MIT recommended):

```
MIT License
Copyright (c) 2025 ukyyyy
```
