// Choosing a campaign: the Bells of Lahti, the hand-written campaigns, the open road, a random
// campaign from the generator, or one the player designs.
import { CAMPAIGNS, randomSpec } from '../world/campaigns';
import { TOWNS, townById } from '../world/atlas';
import type { CampaignSpec } from '../engine/types';
import type { CampaignChoice } from '../engine/game';

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const rng = () => ({ state: (Math.random() * 2 ** 31) >>> 0 });
const KIND_LABEL: Record<string, string> = { undead: 'An undead lord', bandit: 'A bandit king', cult: 'A cult prophet', dragon: 'A dragon', hag: 'A hag', warlord: 'A warlord', beast: 'A monster' };
const GOAL_LABEL: Record<CampaignSpec['goal'], string> = { stop: 'Stop them', rescue: 'Rescue someone', recover: 'Recover something', avenge: 'Get revenge' };

export function openCampaigns(root: HTMLElement, onPick: (c: CampaignChoice, label: string) => void, onCancel: () => void) {
  root.hidden = false;
  let mode: 'list' | 'custom' | 'random' | 'road' = 'list';
  let spec: CampaignSpec = randomSpec(rng(), 1);
  let road = 'breda';

  const card = (id: string, title: string, tag: string, meta: string, cls = '') => `<button type="button" class="camp ${cls}" data-pick="${id}"><b>${esc(title)}</b><span>${esc(tag)}</span><i>${esc(meta)}</i></button>`;

  function render() {
    if (mode === 'list') {
      root.innerHTML = `<div class="camp-inner">
        <div class="forge-head"><button type="button" class="ghost" data-act="cancel">← Back</button><h2>Choose your story</h2><span></span></div>
        <p class="small">Every campaign is set in the same open world. Go off-script whenever you like, and keep playing after the end.</p>
        <div class="camp-grid">
          ${card('bells', 'The Bells of Lahti', 'The original campaign. A bell rings at midnight in the hills above Breda, and nobody is there to ring it.', 'Starts in Breda · levels 1–20 · the full story', 'main')}
          ${CAMPAIGNS.map((c) => card(c.id, c.title, c.tagline, `Starts in ${townById(c.start)?.name} · levels ${c.levels} · ${c.chapters.length} chapters`)).join('')}
          ${card('random', '🎲 A random campaign', 'A new villain, a new threat, a new story, generated for you. There is always another one.', 'Endless · you can reroll it first', 'gen')}
          ${card('custom', '✎ Your own campaign', 'Pick the villain, the threat, the goal, the town, the tone and the length. The game writes the rest.', 'Any town · any level from 1 to 20', 'gen')}
          ${card('road', 'The open road', 'No story at all. Arrive somewhere with a pack and some money and make your own life. Ask for an adventure whenever you want one.', 'Sandbox · start in any town', 'gen')}
        </div></div>`;
      return;
    }
    if (mode === 'road') {
      root.innerHTML = `<div class="camp-inner"><div class="forge-head"><button type="button" class="ghost" data-act="list">← Back</button><h2>The open road</h2><span></span></div>
        <label class="f"><span class="lbl">Where do you arrive?</span><select data-in="road">${TOWNS.map((t) => `<option value="${t.id}"${t.id === road ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <p class="blurb">${esc(townById(road)?.blurb ?? '')}</p>
        <div class="forge-go"><button type="button" class="primary" data-act="go-road">Make my character</button></div></div>`;
      return;
    }
    const s = spec;
    const custom = mode === 'custom';
    root.innerHTML = `<div class="camp-inner"><div class="forge-head"><button type="button" class="ghost" data-act="list">← Back</button><h2>${custom ? 'Your own campaign' : 'A random campaign'}</h2><button type="button" class="ghost" data-act="reroll">🎲 ${custom ? 'Randomise' : 'Reroll'}</button></div>
      ${custom ? `<form class="forge-form" onsubmit="return false">
        <label class="f"><span class="lbl">Title (optional)</span><input type="text" data-in="title" maxlength="60" value="${esc(s.title)}" placeholder="${esc(`${s.villain}, ${s.villainTitle}`)}"></label>
        <div class="g2">
          <label class="f"><span class="lbl">The threat</span><select data-in="kind">${Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}"${s.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">Starting town</span><select data-in="start">${TOWNS.map((t) => `<option value="${t.id}"${t.id === s.start ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">Villain's name</span><input type="text" data-in="villain" maxlength="40" value="${esc(s.villain)}"></label>
          <label class="f"><span class="lbl">Known as</span><input type="text" data-in="villainTitle" maxlength="40" value="${esc(s.villainTitle)}"></label>
          <label class="f"><span class="lbl">Your goal</span><select data-in="goal">${(Object.keys(GOAL_LABEL) as CampaignSpec['goal'][]).map((g) => `<option value="${g}"${s.goal === g ? ' selected' : ''}>${GOAL_LABEL[g]}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">${s.goal === 'rescue' ? 'Who was taken' : s.goal === 'recover' ? 'What was taken' : s.goal === 'avenge' ? 'What they destroyed' : 'What\'s at stake'}</span><input type="text" data-in="target" maxlength="50" value="${esc(s.target)}"></label>
          <label class="f"><span class="lbl">Tone</span><select data-in="tone">${(['heroic', 'grim', 'comic'] as const).map((t) => `<option value="${t}"${s.tone === t ? ' selected' : ''}>${t === 'heroic' ? 'Heroic' : t === 'grim' ? 'Grim' : 'Comic'}</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">Length</span><select data-in="chapters">${[3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}"${s.chapters === n ? ' selected' : ''}>${n} chapters</option>`).join('')}</select></label>
          <label class="f"><span class="lbl">Starting level</span><select data-in="level">${Array.from({ length: 20 }, (_, i) => i + 1).map((n) => `<option value="${n}"${s.level === n ? ' selected' : ''}>Level ${n}</option>`).join('')}</select></label>
        </div></form>` : ''}
      <div class="camp-preview"><b>${esc(s.title.trim() || `${s.villain}, ${s.villainTitle}`)}</b>
        <p>${esc(KIND_LABEL[s.kind] ?? 'A threat')} named <b>${esc(s.villain)}</b>, ${esc(s.villainTitle)}, troubles ${esc(townById(s.start)?.name ?? '')}. ${esc(GOAL_LABEL[s.goal])}: ${esc(s.target)}.</p>
        <p class="small">${s.chapters} chapters · ${s.tone} · starting at level ${s.level}</p></div>
      <div class="forge-go"><button type="button" class="primary" data-act="go-spec">Make my character</button></div></div>`;
  }

  root.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('[data-act],[data-pick]') as HTMLElement | null;
    if (!t) return;
    const pickId = t.dataset.pick;
    if (pickId) {
      if (pickId === 'random') { spec = randomSpec(rng(), 1); mode = 'random'; render(); return; }
      if (pickId === 'custom') { spec = randomSpec(rng(), 1); mode = 'custom'; render(); return; }
      if (pickId === 'road') { mode = 'road'; render(); return; }
      const def = CAMPAIGNS.find((c) => c.id === pickId);
      root.hidden = true;
      onPick({ id: pickId }, pickId === 'bells' ? 'Enter the Smoking Barrel' : `Begin in ${townById(def?.start ?? 'breda')?.name ?? 'Lahti'}`);
      return;
    }
    const a = t.dataset.act;
    if (a === 'cancel') { root.hidden = true; onCancel(); return; }
    if (a === 'list') { mode = 'list'; render(); return; }
    if (a === 'reroll') { const keep = { level: spec.level }; spec = { ...randomSpec(rng(), keep.level) }; render(); return; }
    if (a === 'go-road') { root.hidden = true; onPick({ id: 'open_road', spec: { ...randomSpec(rng(), 1), start: road } }, `Arrive in ${townById(road)?.name}`); return; }
    if (a === 'go-spec') { root.hidden = true; spec.seed = (Math.random() * 2 ** 31) >>> 0; onPick({ id: mode === 'custom' ? 'custom' : 'random', spec: { ...spec, villain: spec.villain.trim() || 'The Nameless', villainTitle: spec.villainTitle.trim() || 'the Nameless One', target: spec.target.trim() || 'the province' } }, `Begin in ${townById(spec.start)?.name}`); return; }
  };
  root.onchange = (e) => {
    const t = e.target as HTMLInputElement;
    const k = t.dataset.in;
    if (!k) return;
    if (k === 'road') { road = t.value; render(); return; }
    const s = spec as unknown as Record<string, unknown>;
    s[k] = ['chapters', 'level'].includes(k) ? Number(t.value) : t.value;
    render();
  };
  root.oninput = (e) => {
    const t = e.target as HTMLInputElement;
    const k = t.dataset.in;
    if (k && ['title', 'villain', 'villainTitle', 'target'].includes(k)) (spec as unknown as Record<string, unknown>)[k] = t.value;
  };
  render();
  root.scrollTop = 0;
}
