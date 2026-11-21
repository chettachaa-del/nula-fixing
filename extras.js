/* NuLa extras: loads AFTER the main script. Uses its T, lang, post, closeAll. */
(() => {
  const $ = id => document.getElementById(id);

  // 1) tappable stars instead of the rating dropdown
  const sel = $("rf-rate");
  if (sel) {
    const box = document.createElement("div");
    box.className = "rate";
    box.setAttribute("role", "radiogroup");
    const paint = n => [...box.children].forEach((b, k) => {
      b.classList.toggle("on", k < n);
      b.setAttribute("aria-checked", String(k + 1 === n));
    });
    for (let n = 1; n <= 5; n++) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "★";
      b.setAttribute("role", "radio"); b.setAttribute("aria-label", n + "/5");
      b.addEventListener("click", () => {
        sel.value = n; paint(n);
        b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
      });
      box.appendChild(b);
    }
    sel.after(box);
    paint(Number(sel.value) || 5);
    $("rev-form").addEventListener("reset", () => setTimeout(() => paint(5)));
  }

  // 2) success overlay with a drawn check mark
  const done = (f, text, after) => {
    const v = document.createElement("div");
    v.className = "okv";
    v.innerHTML = '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg><p></p><button class="btn o sm" type="button"></button>';
    v.querySelector("p").textContent = text;
    const ok = v.querySelector("button");
    ok.textContent = lang === "th" ? "ตกลง" : "OK";
    ok.addEventListener("click", () => { v.remove(); if (after) after(); });
    f.appendChild(v);
  };

  // 3) take over both forms (capture phase runs before the old handlers)
  document.addEventListener("submit", async e => {
    const f = e.target, isRev = f.id === "rev-form", isRes = f.id === "res-form";
    if (!isRev && !isRes) return;
    e.preventDefault(); e.stopImmediatePropagation();

    const t = T[lang], btn = f.querySelector('button[type="submit"]'), m = f.querySelector('[role="status"]');
    const v = id => (f.querySelector("#" + id) || { value: "" }).value.trim();
    const tag = document.querySelector("#detail-body .tag");
    const body = isRev
      ? { action: "review", itemCode: v("rf-code").toUpperCase(), customer: v("rf-name"), province: v("rf-prov"), rating: v("rf-rate"), comment: v("rf-text"), photos: f._ph || [] }
      : { action: "reserve", id: (tag ? tag.textContent.split("·").pop() : "").trim(), name: v("res-name"), contact: v("res-contact"), note: v("res-note") };

    const cb = f.querySelector("#rf-consent");
    if (isRev && (f._ph || []).length && cb && !cb.checked) {
      m.className = "bad";
      m.textContent = lang === "th" ? "กรุณาติ๊กยินยอมให้ร้านใช้รูป" : "Please tick the consent box to include photos";
      f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
      return;
    }
    btn.classList.add("busy"); btn.disabled = true; m.className = ""; m.textContent = "";
    let r;
    try { r = await post(body); } catch (_) { r = { ok: false }; }

    if (r.ok) {
      f.reset();
      done(f, isRev ? t.revOk : t.resOk, isRev ? closeAll : null);
      if (isRev) setTimeout(() => { if (f.querySelector(".okv")) closeAll(); }, 3500);
    } else {
      m.className = "bad";
      m.textContent = r.error || (isRev ? t.revErr : t.resErr);
      f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
    }
    btn.classList.remove("busy"); btn.disabled = false;
  }, true);

  // clear old success overlays when a form is opened again
  document.addEventListener("click", e => {
    if (e.target.closest("#open-rev, #toggle-res")) document.querySelectorAll(".okv").forEach(v => v.remove());
  });
})();

/* 4) photos in review cards: reviews[].photos = file names inside img/ (max 3) */
(() => {
  if (typeof renderReviews !== "function") return;
  const base = renderReviews;
  renderReviews = function () {
    base();
    document.querySelectorAll("#rgrid .rcard").forEach((card, k) => {
      const r = reviews[k];
      const list = (r && Array.isArray(r.photos) ? r.photos : []).map(imgUrl).filter(Boolean).slice(0, 4);
      if (!list.length) return;
      const row = document.createElement("div");
      row.className = "rphotos";
      row.innerHTML = list.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.remove()"></a>`).join("");
      card.insertBefore(row, card.querySelector(".rfoot"));
    });
  };
})();

/* 5) customer photos in the review form: max 2, resized in the browser, consent required */
(() => {
  const f = document.getElementById("rev-form");
  if (!f) return;
  f._ph = [];
  const box = document.createElement("div");
  box.className = "fg";
  box.innerHTML = '<label></label><input type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="pth"></div><label class="cons"><input type="checkbox" id="rf-consent"><span></span></label>';
  const lab = box.querySelector("label"), inp = box.querySelector('input[type="file"]');
  const row = box.querySelector(".pth"), cons = box.querySelector(".cons span");
  const words = () => {
    const th = lang === "th";
    lab.textContent = th ? "แนบรูป (ไม่บังคับ สูงสุด 2 รูป) — อย่าให้เห็นใบหน้า ที่อยู่ เบอร์โทร หรือ IMEI เต็ม" : "Add photos (optional, max 2) — please avoid faces, addresses, phone numbers or full IMEI";
    cons.textContent = th ? "ยินยอมให้ร้านนำรูปไปแสดงบนเว็บไซต์ NuLa (ร้านตรวจก่อนเผยแพร่ และขอลบได้ทุกเมื่อ)" : "I agree NuLa may show these photos on its website (reviewed before publishing, removable on request)";
  };
  words();
  const shrink = file => new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.78));
      };
      im.onerror = rej; im.src = rd.result;
    };
    rd.onerror = rej; rd.readAsDataURL(file);
  });
  const paint = () => {
    row.innerHTML = "";
    f._ph.forEach((src, k) => {
      const w = document.createElement("div");
      w.className = "pt";
      w.innerHTML = '<img alt=""><button type="button" aria-label="remove">✕</button>';
      w.firstChild.src = src;
      w.lastChild.addEventListener("click", () => { f._ph.splice(k, 1); paint(); });
      row.appendChild(w);
    });
  };
  inp.addEventListener("change", async () => {
    for (const file of [...inp.files]) {
      if (f._ph.length >= 2) break;
      try { f._ph.push(await shrink(file)); } catch (_) {}
    }
    inp.value = ""; paint();
  });
  f.addEventListener("reset", () => setTimeout(() => { f._ph = []; paint(); }));
  const t = f.querySelector("#rf-text");
  (t ? t.closest(".fg") : f.lastElementChild).after(box);
  document.getElementById("lang").addEventListener("click", () => setTimeout(words));
})();
