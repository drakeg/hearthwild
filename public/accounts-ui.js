const $ = (id) => document.getElementById(id);
export function accountUi({ api, onEnter, onLeave }) {
  let account = null,
    setup = null;
  const loginView = () => {
    $("account-panel").hidden = false;
    $("roster-panel").hidden = true;
    $("join").hidden = true;
  };
  async function roster() {
    onLeave();
    try {
      const data = await api("/api/characters");
      account = data.account;
      $("account-name").textContent = `${account.username} · ACCOUNT`;
      $("account-panel").hidden = true;
      $("join").hidden = true;
      $("roster-panel").hidden = false;
      $("character-roster").replaceChildren();
      if (!data.characters.length) {
        const p = document.createElement("p");
        p.textContent =
          "Create your first adventurer. You can have up to twelve characters.";
        $("character-roster").append(p);
      }
      for (const c of data.characters) {
        const b = document.createElement("button"),
          name = document.createElement("strong"),
          info = document.createElement("small");
        name.textContent = c.name;
        info.textContent = `Level ${c.level} ${c.classId} · ${c.faction} · ${c.coins} gold`;
        b.append(name, info);
        b.onclick = () => onEnter(c.id);
        $("character-roster").append(b);
      }
      $("new-character").disabled = data.characters.length >= 12;
    } catch (e) {
      loginView();
      $("account-error").textContent = e.status === 401 ? "" : e.message;
    }
  }
  async function authenticate(create) {
    $("account-error").textContent = "";
    $("sign-in").disabled = true;
    $("create-account").disabled = true;
    try {
      await api(create ? "/api/accounts/register" : "/api/accounts/login", {
        username: $("username").value,
        password: $("password").value,
      });
      $("password").value = "";
      await roster();
    } catch (e) {
      $("account-error").textContent = e.message;
    } finally {
      $("sign-in").disabled = false;
      $("create-account").disabled = false;
    }
  }
  $("account-form").onsubmit = (e) => {
    e.preventDefault();
    authenticate(false);
  };
  $("create-account").onclick = () => {
    if ($("account-form").reportValidity()) authenticate(true);
  };
  $("new-character").onclick = () => {
    $("roster-panel").hidden = true;
    $("join").hidden = false;
    $("entry-error").textContent = "";
    $("name").focus();
  };
  $("back-roster").onclick = roster;
  $("sign-out").onclick = async () => {
    await api("/api/accounts/logout", {});
    account = null;
    sessionStorage.removeItem("hearthwild-character");
    loginView();
  };
  $("characters-menu").onclick = roster;
  $("roster-shortcut").onclick = roster;
  $("join").onsubmit = async (e) => {
    e.preventDefault();
    $("enter").disabled = true;
    try {
      const r = await api("/api/characters", {
        name: $("name").value,
        faction: new FormData(e.target).get("faction"),
        classId: $("class-choice").value,
        gender: new FormData(e.target).get("gender") ?? "male",
      });
      await onEnter(r.id);
    } catch (e) {
      $("entry-error").textContent = e.message;
    } finally {
      $("enter").disabled = false;
    }
  };
  async function start() {
    sessionStorage.removeItem("hearthwild-key");
    try {
      setup = await api("/api/setup");
      $("setup-note").textContent = setup.needsSetup
        ? setup.legacyCount
          ? `Create your local account to recover ${setup.legacyCount} existing adventurers—no old return codes needed.`
          : "Create an account, then make your first character."
        : "Sign in to choose one of your characters.";
      await roster();
    } catch (e) {
      loginView();
      $("account-error").textContent = e.message;
    }
  }
  return { start, roster, logout: () => $("sign-out").onclick() };
}
