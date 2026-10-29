// The Forge: the original form-based character creator, with a live preview.
import { CLASSES, SPECIES, BACKGROUNDS, FEATS, SPELLS, ITEMS, classById, speciesById, backgroundById } from '../engine/srd';
import { LIFE } from '../data/lifepath';
import { arrayFor } from '../data/classes';
import { defaultSpec, finalAbilities, createFromSpec, armorClass, spellDC, prof, isCantrip, fmtMoney } from '../engine/character';
import { mod, fmtMod } from '../engine/dice';
import { ABILITIES, type Abilities, type Ability, type CreationSpec, type Skill } from '../engine/types';

const ALL_SKILLS: Skill[] = ['acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival'];
const ABN: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const PB: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const ARRAY = [15, 14, 13, 12, 10, 8];
const NAMES = ['Tess', 'Aldric', 'Mira', 'Corvin', 'Ysolde', 'Brann', 'Lisbet', 'Oskar', 'Vesna', 'Havel', 'Juno', 'Dariusz', 'Elka', 'Pell', 'Rook', 'Sabine', 'Tomas', 'Wren', 'Kasimir', 'Nadia'];

type Method = 'array' | 'roll' | 'pb';
interface ForgeState { spec: CreationSpec; method: Method; rolled: number[]; err: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const cap = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
const r = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: T[]) => a[r(a.length)];

function roll4d6(): number { const d = [0, 0, 0, 0].map(() => 1 + r(6)).sort((a, b) => b - a); return d[0] + d[1] + d[2]; }

function assign(spec: CreationSpec, vals: number[]) {
  const k = classById(spec.cls);
  const order: Ability[] = Array.from(new Set<Ability>([...k.primary, 'con', 'dex', 'wis', 'cha', 'int', 'str']));
  const sorted = [...vals].sort((a, b) => b - a);
  const a = { ...spec.base };
  order.forEach((ab, i) => (a[ab] = sorted[i]));
  spec.base = a;
}

export function openForge(root: HTMLElement, onDone: (spec: CreationSpec) => void, onCancel: () => void) {
  const F: ForgeState = { spec: defaultSpec('fighter', 'human', 'soldier', ''), method: 'array', rolled: [], err: '' };
  F.spec.name = '';
  root.hidden = false;

  const fixSpec = () => {
    const s = F.spec;
    const k = classById(s.cls);
    const bg = backgroundById(s.background);
    const sp = speciesById(s.species);
    if (sp.variants?.length && !sp.variants.some((v) => v.id === s.variant)) s.variant = sp.variants[0].id;
    if (!sp.variants?.length) s.variant = undefined;
    for (const o of k.options ?? []) if (!o.choices.some((c) => c.id === s.options[o.id])) s.options[o.id] = o.choices[0].id;
    for (const key of Object.keys(s.options)) if (!(k.options ?? []).some((o) => o.id === key)) delete s.options[key];
    if (!bg.abilities.includes(s.boost.plus2)) s.boost.plus2 = bg.abilities[0];
    if (!bg.abilities.includes(s.boost.plus1) || s.boost.plus1 === s.boost.plus2) s.boost.plus1 = bg.abilities.find((a) => a !== s.boost.plus2)!;
    s.skills = s.skills.filter((x) => k.skillChoices.includes(x) && !bg.skills.includes(x)).slice(0, k.skillCount);
    const list = k.casting?.list ?? [];
    s.cantrips = s.cantrips.filter((x) => list.includes(x)).slice(0, k.casting?.cantrips ?? 0);
    s.spells = s.spells.filter((x) => list.includes(x)).slice(0, k.casting?.prepared[0] ?? 0);
  };

  const kitItems = (): [string, number][] => {
    const k = classById(F.spec.cls); const bg = backgroundById(F.spec.background);
    const m = new Map<string, number>();
    for (const [id, q] of [...k.kit, ...bg.kit]) m.set(id, (m.get(id) ?? 0) + q);
    return Array.from(m.entries()).filter(([id]) => ITEMS[id]);
  };

  function render() {
    fixSpec();
    const s = F.spec;
    const k = classById(s.cls);
    const sp = speciesById(s.species);
    const bg = backgroundById(s.background);
    const groups = ['Common folk', 'Rare folk', 'Strange folk'] as const;
    const fa = finalAbilities(s);
    const bonus = (a: Ability) => fa[a] - s.base[a];
    const abilityInputs = ABILITIES.map((a) => {
      let ctl = '';
      if (F.method === 'pb') ctl = `<div class="step"><button type="button" data-act="pb-" data-a="${a}" aria-label="Lower ${ABN[a]}">−</button><b>${s.base[a]}</b><button type="button" data-act="pb+" data-a="${a}" aria-label="Raise ${ABN[a]}">+</button></div>`;
      else { const vals = F.method === 'roll' ? F.rolled : ARRAY; ctl = `<select data-act="swap" data-a="${a}" aria-label="${ABN[a]}">${vals.map((v, i) => `<option value="${i}"${s.base[a] === v ? ' selected' : ''}>${v}</option>`).join('')}</select>`; }
      return `<div class="ab-in"><span class="lbl">${a.toUpperCase()}</span>${ctl}<span class="tot">${fa[a]}</span><span class="small">${bonus(a) ? `+${bonus(a)} · ` : ''}${fmtMod(mod(fa[a]))}</span></div>`;
    }).join('');
    const spent = ABILITIES.reduce((n, a) => n + (PB[s.base[a]] ?? 99), 0);
    const casting = k.casting;
    const list = casting?.list ?? [];
    const cantripList = list.filter(isCantrip);
    const l1List = list.filter((x) => !isCantrip(x));
    const chips = (ids: string[], chosen: string[], max: number, act: string) => ids.map((id) => { const on = chosen.includes(id); const sd = SPELLS[id]; return `<button type="button" class="chip${on ? ' on' : ''}" data-act="${act}" data-id="${id}"${!on && chosen.length >= max ? ' disabled' : ''} title="${esc(sd.desc)}">${esc(sd.name)}${sd.original ? ' ✦' : ''}</button>`; }).join('');
    const kit = kitItems();
    root.innerHTML = `<div class="forge-inner">
      <div class="forge-head"><button type="button" class="ghost" data-act="cancel">← Back</button><h2>The Forge</h2><button type="button" class="ghost" data-act="random">🎲 Random</button></div>
      <div class="forge-grid">
      <form class="forge-form" autocomplete="off" onsubmit="return false">
        <section><div class="g2">
          <label class="f"><span class="lbl">Name</span><input type="text" data-in="name" maxlength="24" value="${esc(s.name)}" placeholder="What the tavern calls you"></label>
          <label class="f"><span class="lbl">Pronouns</span><select data-in="pronoun">${(['he', 'she', 'they'] as const).map((p) => `<option value="${p}"${s.pronoun === p ? ' selected' : ''}>${p === 'he' ? 'he / him' : p === 'she' ? 'she / her' : 'they / them'}</option>`).join('')}</select></label>
        </div></section>

        <section><h3>Species</h3><div class="g2">
          <label class="f"><span class="lbl">Species</span><select data-in="species">${groups.map((g) => `<optgroup label="${g}">${SPECIES.filter((x) => x.group === g).map((x) => `<option value="${x.id}"${x.id === s.species ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
          ${sp.variants?.length ? `<label class="f"><span class="lbl">${esc(sp.variantLabel ?? 'Lineage')}</span><select data-in="variant">${sp.variants.map((v) => `<option value="${v.id}"${v.id === s.variant ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>` : '<div></div>'}
        </div>
        <p class="blurb">${esc(sp.blurb)}</p><p class="small">${esc(sp.lore)}</p>
        <ul class="traits">${sp.traits.map((t) => `<li>${esc(t)}</li>`).join('')}${sp.power ? `<li><b>${esc(sp.power.name)}.</b> ${esc(sp.power.desc)}</li>` : ''}${sp.variants?.length ? `<li><b>${esc(sp.variants.find((v) => v.id === s.variant)?.name ?? '')}.</b> ${esc(sp.variants.find((v) => v.id === s.variant)?.desc ?? '')}</li>` : ''}</ul>
        <p class="small">${sp.size} · speed ${sp.speed} ft${sp.darkvision ? ` · darkvision ${sp.darkvision} ft` : ''}</p></section>

        <section><h3>Class</h3><div class="g2">
          <label class="f"><span class="lbl">Class</span><select data-in="cls">${CLASSES.map((x) => `<option value="${x.id}"${x.id === s.cls ? ' selected' : ''}>${esc(x.name)} — ${esc(x.title)}</option>`).join('')}</select></label>
          ${(k.options ?? []).map((o) => `<label class="f"><span class="lbl">${esc(o.label)}</span><select data-opt="${o.id}">${o.choices.map((c) => `<option value="${c.id}"${s.options[o.id] === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`).join('')}
        </div>
        <p class="blurb">${esc(k.blurb)}</p>
        <p class="small"><b>Kalashscovia twist:</b> ${esc(k.twist)}</p>
        ${(k.options ?? []).map((o) => { const ch = o.choices.find((c) => c.id === s.options[o.id]); return ch ? `<p class="small"><b>${esc(ch.name)}:</b> ${esc(ch.desc)}</p>` : ''; }).join('')}
        <ul class="traits">${(k.features[1] ?? []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="small">Hit die d${k.hitDie} · saves ${k.saves.map((a) => a.toUpperCase()).join(', ')} · armour ${k.armorProf.length ? k.armorProf.join(', ') : 'none'} · weapons ${k.weaponProf.join(', ')}. Subclasses arrive at level 3.</p></section>

        <section><h3>Background</h3><div class="g3">
          <label class="f span2"><span class="lbl">Background (sets your ability boosts and feat)</span><select data-in="background">${BACKGROUNDS.map((b) => `<option value="${b.id}"${b.id === s.background ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">+2</span><select data-in="plus2"${s.boost.even ? ' disabled' : ''}>${bg.abilities.map((a) => `<option value="${a}"${s.boost.plus2 === a ? ' selected' : ''}>${ABN[a]}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">+1</span><select data-in="plus1"${s.boost.even ? ' disabled' : ''}>${bg.abilities.filter((a) => a !== s.boost.plus2).map((a) => `<option value="${a}"${s.boost.plus1 === a ? ' selected' : ''}>${ABN[a]}</option>`).join('')}</select></label>
        </div>
        <label class="f check"><input type="checkbox" data-in="even"${s.boost.even ? ' checked' : ''}> <span>Spread it: +1 to ${bg.abilities.map((a) => ABN[a]).join(', ')}</span></label>
        <p class="blurb">${esc(bg.blurb)}</p>
        <p class="small">Skills: ${bg.skills.map(cap).join(', ')} · Feat: <b>${esc(FEATS[bg.feat]?.name ?? bg.feat)}</b> — ${esc(FEATS[bg.feat]?.desc ?? '')}</p></section>

        <section><div class="row-between"><h3>Abilities</h3><div class="row">
          <button type="button" class="sm${F.method === 'array' ? ' on' : ''}" data-act="m-array">Standard array</button>
          <button type="button" class="sm${F.method === 'roll' ? ' on' : ''}" data-act="m-roll">Roll 4d6</button>
          <button type="button" class="sm${F.method === 'pb' ? ' on' : ''}" data-act="m-pb">Point buy</button></div></div>
          <div class="ab-grid">${abilityInputs}</div>
          <p class="small">${F.method === 'pb' ? `Point buy: ${27 - spent} of 27 points left. Scores run from 8 to 15.` : F.method === 'roll' ? `Rolled: ${F.rolled.join(', ')}. Pick a score for each ability; picking one that's taken swaps them. <button type="button" class="link" data-act="m-roll">Reroll</button>` : 'Pick a score for each ability; picking one that\'s taken swaps them.'} ${esc(k.name)}s want ${k.primary.map((a) => ABN[a]).join(' and ')}.</p></section>

        <section><h3>Skills</h3><p class="small">Pick ${k.skillCount} from your class list. Your background's skills are already marked.</p>
          <div class="chips wrap">${ALL_SKILLS.map((sk) => { const fromBg = bg.skills.includes(sk); const fromSp = (sp.skills ?? []).includes(sk); const on = s.skills.includes(sk); const allowed = k.skillChoices.includes(sk); return `<button type="button" class="chip${on || fromBg || fromSp ? ' on' : ''}${fromBg || fromSp ? ' locked' : ''}" data-act="skill" data-id="${sk}"${fromBg || fromSp || (!allowed && !on) || (!on && s.skills.length >= k.skillCount) ? ' disabled' : ''}>${cap(sk)}${fromBg ? ' · bg' : fromSp ? ' · species' : ''}</button>`; }).join('')}</div>
          <p class="small">Picked ${s.skills.length} / ${k.skillCount}.${['rogue', 'bard'].includes(k.id) ? ' Expertise comes automatically (rogues at 1, bards at 2).' : ''}</p></section>

        ${casting ? `<section><h3>Spells</h3><p class="small">✦ marks Hams Tavern originals. Hold or hover for what a spell does.</p>
          ${casting.cantrips ? `<div class="lbl">Cantrips · ${s.cantrips.length}/${casting.cantrips}</div><div class="chips wrap">${chips(cantripList, s.cantrips, casting.cantrips, 'cantrip')}</div>` : ''}
          ${casting.prepared[0] ? `<div class="lbl">1st-level spells · ${s.spells.length}/${casting.prepared[0]}</div><div class="chips wrap">${chips(l1List, s.spells, casting.prepared[0], 'spell')}</div>` : ''}
          ${k.id === 'paladin' || k.id === 'ranger' ? `<p class="small">${k.id === 'paladin' ? 'Paladins start casting at level 2 (Divine Smite comes with it).' : 'You always know Hunter\'s Mark.'}</p>` : ''}</section>` : ''}

        <section><div class="row-between"><h3>Your life before</h3><button type="button" class="sm" data-act="life">🎲 Roll my life</button></div>
          ${LIFE.map((t) => `<label class="f"><span class="lbl">${esc(t.label)}</span><select data-life="${t.id}">${t.entries.map((e) => `<option value="${e.id}"${s.life[t.id] === e.id ? ' selected' : ''}>${esc(e.text)}</option>`).join('')}</select></label>`).join('')}
          <p class="small">All of it is canon. Some people in Lahti will remember.</p></section>

        <section><h3>The hero</h3>
          <label class="f"><span class="lbl">Face and body</span><input type="text" data-in="look" maxlength="240" value="${esc(s.look)}" placeholder="Scar through the left brow, broad shoulders, grey at the temples"></label>
          <label class="f"><span class="lbl">Backstory (one field, and it is canon)</span><textarea data-in="backstory" rows="4" maxlength="2000" placeholder="Where you came from, who you owe, what you won't do.">${esc(s.backstory)}</textarea></label></section>

        <section><h3>Starting kit</h3>
          <div class="kit">${kit.map(([id, q]) => `<label class="it"><input type="checkbox" data-kit="${id}"${s.removedKit.includes(id) ? '' : ' checked'}> <span>${esc(ITEMS[id].name)}${q > 1 ? ` × ${q}` : ''}</span></label>`).join('')}
            <div class="it"><span>Potion of Healing</span></div>
            ${s.customItems.map((it, i) => `<div class="it"><span>${esc(it)} <span class="small">custom</span></span><button type="button" class="link" data-act="del-item" data-i="${i}">Remove</button></div>`).join('')}</div>
          <div class="row"><input type="text" id="forge-add" maxlength="60" placeholder="Add a keepsake, e.g. Grandmother's silver locket"><button type="button" class="sm" data-act="add-item">Add</button></div></section>

        <div class="forge-go"><button type="button" class="primary" data-act="begin">Enter the Smoking Barrel</button><span class="err">${esc(F.err)}</span></div>
      </form>
      <aside class="forge-preview" id="forge-preview"></aside>
      </div></div>`;
    preview();
  }

  function preview() {
    const el = root.querySelector('#forge-preview');
    if (!el) return;
    const s = F.spec;
    const k = classById(s.cls);
    let pc;
    try { pc = createFromSpec({ ...s, name: s.name || 'Unnamed' }); } catch { el.innerHTML = ''; return; }
    const sp = speciesById(s.species);
    el.innerHTML = `<div class="pv-name">${esc(s.name || 'Unnamed')}</div>
      <div class="small">${esc(sp.name)}${s.variant ? ` (${esc(sp.variants?.find((v) => v.id === s.variant)?.name ?? '')})` : ''} · ${esc(k.name)} · ${esc(backgroundById(s.background).name)}</div>
      <dl class="kv"><dt>Hit points</dt><dd>${pc.maxHp}</dd><dt>Armour class</dt><dd>${armorClass(pc)}</dd><dt>Proficiency</dt><dd>+${prof(pc)}</dd><dt>Speed</dt><dd>${sp.speed} ft</dd>${k.casting ? `<dt>Spell DC</dt><dd>${spellDC(pc)}</dd>` : ''}<dt>Purse</dt><dd>${fmtMoney(pc.copper)}</dd></dl>
      <div class="abil">${ABILITIES.map((a) => `<div class="ab"><span class="k">${a.toUpperCase()}</span><span class="m">${fmtMod(mod(pc.abilities[a]))}</span><span class="s">${pc.abilities[a]}</span></div>`).join('')}</div>
      <div class="small">Skills: ${pc.skills.map(cap).join(', ')}</div>
      ${pc.cantrips.length || pc.spells.length ? `<div class="small">Spells: ${[...pc.cantrips, ...pc.spells].map((x) => SPELLS[x]?.name).join(', ')}</div>` : ''}`;
  }

  function check(): string {
    const s = F.spec; const k = classById(s.cls);
    if (!s.name.trim()) return 'Give your hero a name.';
    if (F.method === 'pb' && ABILITIES.reduce((n, a) => n + (PB[s.base[a]] ?? 99), 0) > 27) return 'Too many points spent.';
    if (s.skills.length < k.skillCount) return `Pick ${k.skillCount - s.skills.length} more skill${k.skillCount - s.skills.length > 1 ? 's' : ''}.`;
    if (k.casting && s.cantrips.length < k.casting.cantrips) return 'Pick your cantrips.';
    if (k.casting && s.spells.length < k.casting.prepared[0]) return 'Pick your 1st-level spells.';
    return '';
  }

  function randomHero() {
    const k = pick(CLASSES); const sp = pick(SPECIES); const bg = pick(BACKGROUNDS);
    const s = defaultSpec(k.id, sp.id, bg.id, pick(NAMES));
    s.variant = sp.variants?.length ? pick(sp.variants).id : undefined;
    for (const o of k.options ?? []) s.options[o.id] = pick(o.choices).id;
    const pool = k.skillChoices.filter((x) => !bg.skills.includes(x));
    s.skills = []; while (s.skills.length < k.skillCount && pool.length) s.skills.push(pool.splice(r(pool.length), 1)[0]);
    const list = k.casting?.list ?? [];
    const cs = list.filter(isCantrip); const ls = list.filter((x) => !isCantrip(x));
    s.cantrips = []; while (s.cantrips.length < (k.casting?.cantrips ?? 0) && cs.length) s.cantrips.push(cs.splice(r(cs.length), 1)[0]);
    s.spells = []; while (s.spells.length < (k.casting?.prepared[0] ?? 0) && ls.length) s.spells.push(ls.splice(r(ls.length), 1)[0]);
    for (const t of LIFE) s.life[t.id] = pick(t.entries).id;
    s.pronoun = pick(['he', 'she', 'they'] as const);
    F.spec = s; F.method = 'array';
  }

  root.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    const s = F.spec;
    const act = t.dataset.act!;
    const toggle = (arr: string[], id: string) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); else arr.push(id); };
    switch (act) {
      case 'cancel': root.hidden = true; onCancel(); return;
      case 'random': randomHero(); break;
      case 'm-array': F.method = 'array'; assign(s, ARRAY); break;
      case 'm-roll': F.method = 'roll'; F.rolled = Array.from({ length: 6 }, roll4d6).sort((a, b) => b - a); assign(s, F.rolled); break;
      case 'm-pb': F.method = 'pb'; s.base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } as Abilities; { const k = classById(s.cls); s.base[k.primary[0]] = 15; s.base.con = Math.max(s.base.con, 13); if (k.primary[1] && k.primary[1] !== 'con') s.base[k.primary[1]] = 13; } break;
      case 'pb+': case 'pb-': {
        const a = t.dataset.a as Ability; const v = s.base[a] + (act === 'pb+' ? 1 : -1);
        if (v < 8 || v > 15) return;
        const spent = ABILITIES.reduce((n, x) => n + PB[x === a ? v : s.base[x]], 0);
        if (spent > 27) return;
        s.base[a] = v; break;
      }
      case 'skill': toggle(s.skills, t.dataset.id!); break;
      case 'cantrip': toggle(s.cantrips, t.dataset.id!); break;
      case 'spell': toggle(s.spells, t.dataset.id!); break;
      case 'life': for (const tb of LIFE) s.life[tb.id] = pick(tb.entries).id; break;
      case 'add-item': { const inp = root.querySelector('#forge-add') as HTMLInputElement; const v = inp.value.trim(); if (v && s.customItems.length < 5) s.customItems.push(v); break; }
      case 'del-item': s.customItems.splice(Number(t.dataset.i), 1); break;
      case 'begin': { const err = check(); if (err) { F.err = err; render(); return; } root.hidden = true; root.innerHTML = ''; onDone(JSON.parse(JSON.stringify(s))); return; }
      default: return;
    }
    F.err = '';
    const y = root.scrollTop; render(); root.scrollTop = y;
  };

  root.onchange = (e) => {
    const t = e.target as HTMLInputElement & HTMLSelectElement;
    const s = F.spec;
    const k = t.dataset.in;
    if (k === 'name') { s.name = t.value.replace(/[^\p{L}\p{N}' -]/gu, '').slice(0, 24); preview(); return; }
    if (k === 'look') { s.look = t.value; return; }
    if (k === 'backstory') { s.backstory = t.value; return; }
    if (k === 'pronoun') s.pronoun = t.value as CreationSpec['pronoun'];
    else if (k === 'species') { s.species = t.value; s.variant = undefined; }
    else if (k === 'variant') s.variant = t.value;
    else if (k === 'cls') { s.cls = t.value; s.options = {}; s.skills = []; s.cantrips = []; s.spells = []; s.removedKit = []; if (F.method === 'array') s.base = arrayFor(classById(s.cls)); else if (F.method === 'roll') assign(s, F.rolled); }
    else if (k === 'background') { s.background = t.value; s.removedKit = []; }
    else if (k === 'even') s.boost.even = t.checked;
    else if (k === 'plus2') s.boost.plus2 = t.value as Ability;
    else if (k === 'plus1') s.boost.plus1 = t.value as Ability;
    else if (t.dataset.opt) s.options[t.dataset.opt] = t.value;
    else if (t.dataset.life) s.life[t.dataset.life] = t.value;
    else if (t.dataset.kit) { const id = t.dataset.kit; if (t.checked) s.removedKit = s.removedKit.filter((x) => x !== id); else s.removedKit.push(id); preview(); return; }
    else if (t.dataset.act === 'swap') {
      const a = t.dataset.a as Ability; const vals = F.method === 'roll' ? F.rolled : ARRAY; const v = vals[Number(t.value)];
      const other = ABILITIES.find((x) => x !== a && s.base[x] === v);
      if (other) s.base[other] = s.base[a];
      s.base[a] = v;
    } else return;
    const y = root.scrollTop; render(); root.scrollTop = y;
  };
  root.oninput = (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.in === 'name') { F.spec.name = t.value.replace(/[^\p{L}\p{N}' -]/gu, '').slice(0, 24); preview(); }
    else if (t.dataset.in === 'look') F.spec.look = t.value;
    else if (t.dataset.in === 'backstory') F.spec.backstory = t.value;
  };

  render();
  root.scrollTop = 0;
}
