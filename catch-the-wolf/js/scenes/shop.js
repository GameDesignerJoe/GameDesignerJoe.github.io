// The shop: trade pelts for sheep. Cards are generated from data/breeds.json.

import { db, buy, buyItem } from '../game/rules.js';
import { ITEM_PAINTERS } from '../art/props.js';
import { iconURL } from '../art/icons.js';
import { titleBackdrop } from './backdrop.js';
import { peltURL, sheepURL } from '../art/icons.js';
import { el, hudPelts, bumpPelts, banner } from './ui.js';

export const shopScene = {
  enter(app) {
    this.app = app;
    const s = app.save.data;
    this.ui = el(`
      <div class="shop-wrap">
        <div class="shop-head">
          <button class="btn small" data-act="back" aria-label="Back to menu">◀</button>
          <h1>The Shop</h1>
          ${hudPelts(s.pelts)}
        </div>
        <div class="shop-sub" data-sub></div>
        <div class="tabs" role="tablist">
          <button class="btn small" role="tab" data-tab="sheep">Sheep</button>
          <button class="btn small" role="tab" data-tab="goodies">Farm goodies</button>
        </div>
        <div class="shop-grid" data-grid></div>
        <div class="bottombar" style="position:static;justify-content:center;padding-top:8px">
          <button class="btn green" data-act="farm">Visit Farm</button>
          <button class="btn red" data-act="play">Hunt wolves</button>
        </div>
      </div>`);
    app.ui.append(this.ui);
    this.ui.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const buyId = e.target.closest('[data-buy]')?.dataset.buy;
      const itemId = e.target.closest('[data-item]')?.dataset.item;
      const tab = e.target.closest('[data-tab]')?.dataset.tab;
      if (tab) { app.sfx.tap(); this.tab = tab; this.render(); this.ui.querySelector('[data-grid]').scrollTop = 0; return; }
      if (act) { app.sfx.tap(); app.go(act === 'back' ? 'title' : act); }
      if (buyId) this.purchase(buyId);
      if (itemId) this.purchaseItem(itemId);
    });
    this.tab = this.tab || 'sheep';
    this.render();
  },

  exit() { this.bg = null; },

  render() {
    const s = this.app.save.data;
    const counts = {};
    for (const a of s.farm) counts[a.breed] = (counts[a.breed] || 0) + 1;
    const full = s.farm.length >= db.game.farmCap;
    this.ui.querySelector('[data-sub]').textContent = full
      ? `Farm full (${s.farm.length}/${db.game.farmCap}) · let a sheep go at the farm gate`
      : `Trade wolf pelts for sheep · Farm ${s.farm.length}/${db.game.farmCap}`;
    const goodies = db.items.map((it) => {
      const afford = s.pelts >= it.price;
      const have = it.kind === 'food' ? s.pantry[it.id] || 0 : s.toys.filter((t) => t.item === it.id).length;
      // Fit any item into the icon: foods are ~84 units wide, balls 3.2 radii.
      const fit = it.kind === 'food' ? 1.05 : 26 / it.r;
      const icon = iconURL(`item2-${it.id}`, 96, 96, (c) => { c.translate(48, 50); c.scale(fit, fit); ITEM_PAINTERS[it.paint](c, { r: it.r }); });
      return `<div class="card goodie">
        ${have ? `<span class="owned">×${have}</span>` : ''}
        <img class="sheep" src="${icon}" alt="${it.name}">
        <h3>${it.name}<small>${it.kind === 'food' ? 'Sheep flock to eat it' : 'Sheep chase & roll it'}</small></h3>
        <button class="btn small ${afford ? 'gold' : ''}" data-item="${it.id}" aria-label="Buy ${it.name} for ${it.price} pelts">
          <img src="${peltURL()}" alt="pelts">${it.price}
        </button>
      </div>`;
    }).join('');
    this.ui.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('sky', b.dataset.tab === this.tab); b.setAttribute('aria-selected', b.dataset.tab === this.tab); });
    if (this.tab === 'goodies') { this.ui.querySelector('[data-grid]').innerHTML = goodies; return; }
    this.ui.querySelector('[data-grid]').innerHTML = db.breeds.filter((b) => b.price != null).map((b) => {
      const afford = s.pelts >= b.price;
      return `<div class="card">
        ${counts[b.id] ? `<span class="owned">×${counts[b.id]}</span>` : ''}
        <img class="sheep" src="${sheepURL(b.id, b.look, 120)}" alt="${b.name}">
        <h3>${b.name}</h3>
        <button class="btn small ${afford && !full ? 'gold' : ''}" data-buy="${b.id}" aria-label="Buy ${b.name} for ${b.price} pelts">
          <img src="${peltURL()}" alt="pelts">${b.price}
        </button>
      </div>`;
    }).join('');
  },

  purchaseItem(id) {
    const { app } = this;
    const r = buyItem(app.save.data, id);
    if (r.ok) {
      app.save.write();
      app.sfx.coin();
      app.haptic(20);
      banner(app.ui, `${r.item.name}!`, r.item.kind === 'food' ? 'Put it out from the farm tray' : 'It\'s waiting on your farm', 'good low');
      bumpPelts(this.ui, app.save.data.pelts);
      this.render();
    } else {
      app.sfx.wrong();
      const msg = r.reason === 'toys' ? ['Toy box is full!', `Up to ${db.itemRules.maxToys} toys on the farm`]
        : ['Need more wolves!', `${r.need} more pelt${r.need === 1 ? '' : 's'} to go`];
      banner(app.ui, msg[0], msg[1], 'bad low');
    }
  },

  purchase(id) {
    const { app } = this;
    const r = buy(app.save.data, id);
    if (r.ok) {
      r.animal.isNew = true;
      app.save.write();
      app.sfx.coin();
      setTimeout(() => app.sfx.baa(1.1), 180);
      app.haptic(25);
      banner(app.ui, 'Purchase successful!', `Say hello to ${r.animal.name}`, 'good low');
      bumpPelts(this.ui, app.save.data.pelts);
      this.render();
    } else {
      app.sfx.wrong();
      const msg = r.reason === 'full' ? ['Farm is full!', 'Drag a sheep to the farm gate to let it go']
        : ['Need more wolves!', `${r.need} more pelt${r.need === 1 ? '' : 's'} to go`];
      banner(app.ui, msg[0], msg[1], 'bad low');
    }
  },

  resize(w, h) { this.bg = titleBackdrop(w, h, this.app.dpr); },
  draw(ctx) {
    if (!this.bg) return;
    ctx.drawImage(this.bg.canvas, 0, 0, this.app.w, this.app.h);
    ctx.fillStyle = 'rgba(40,70,30,0.35)';
    ctx.fillRect(0, 0, this.app.w, this.app.h);
  },
};
