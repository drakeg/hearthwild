const el = (tag, text) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
};
export function gameMenu({
  stop,
  resume,
  characters,
  logout,
  quit,
  camera,
  getCamera,
  graphics,
}) {
  const d = el("dialog");
  d.id = "game-menu";
  d.setAttribute("aria-label", "Game menu");
  const h = el("h2", "Hearthwild"),
    note = el("p", "The online world continues while this menu is open.");
  d.append(h, note);
  const button = (text, fn) => {
    const b = el("button", text);
    b.onclick = async () => {
      try {
        await fn();
      } catch (e) {
        status.textContent = e.message;
      }
    };
    d.append(b);
    return b;
  };
  button("Resume", () => close());
  button("Character selection", () => {
    close();
    characters();
  });
  button("Log out", async () => {
    close();
    await logout();
  });
  const label = el("label", "Camera view"),
    select = el("select");
  select.id = "camera-view";
  label.htmlFor = select.id;
  for (const [value, text] of [
    ["orbit", "Orbit · independent camera"],
    ["follow", "Follow behind character"],
    ["first", "First person"],
  ]) {
    const o = el("option", text);
    o.value = value;
    select.append(o);
  }
  select.onchange = () => camera({ mode: select.value });
  d.append(label, select);
  const sensitivityLabel = el("label", "Mouse sensitivity"),
    range = el("input");
  range.type = "range";
  range.min = "0.002";
  range.max = "0.012";
  range.step = "0.001";
  range.id = "mouse-sensitivity";
  sensitivityLabel.htmlFor = range.id;
  range.oninput = () => camera({ sensitivity: Number(range.value) });
  d.append(
    sensitivityLabel,
    range,
    el(
      "p",
      "WASD / arrows: move relative to your view. Drag left or right mouse: orbit and tilt. Right-drag: turn character with camera. Wheel: zoom. V: switch view. K: professions.",
    ),
  );
  if (graphics) {
    const gl = el("label", "Graphics quality"),
      gs = el("select");
    gs.id = "graphics-quality";
    gl.htmlFor = gs.id;
    for (const [value, text] of [
      ["high", "High · shadows, dense foliage"],
      ["low", "Low · faster on older computers"],
    ]) {
      const o = el("option", text);
      o.value = value;
      gs.append(o);
    }
    gs.value = graphics.current;
    gs.onchange = () => {
      graphics.set(gs.value);
      status.textContent = "Graphics setting saved. It applies the next time the world loads.";
    };
    d.append(gl, gs);
  }
  const q = button("Quit game", () => quit());
  q.title = "Quit the desktop app; in a browser this returns to sign-in.";
  const status = el("p");
  status.setAttribute("role", "status");
  d.append(status);
  document.getElementById("hud").append(d);
  function close() {
    d.close();
    resume();
  }
  function open() {
    stop();
    const c = getCamera();
    select.value = c.mode;
    range.value = c.sensitivity;
    status.textContent = "";
    d.showModal();
    d.querySelector("button").focus();
  }
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  return {
    open,
    close,
    toggle() {
      d.open ? close() : open();
    },
    isOpen: () => d.open,
  };
}
