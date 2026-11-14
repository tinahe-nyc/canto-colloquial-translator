/* The build inlines this browser script into the coach page. */
(() => {
  "use strict";

  const bookKey = "kapok.phrasebook.v1";
  const reviewKey = "kapok.review.v1";
  const intervals = [0, 1, 3, 7, 16, 35];
  const languages = { cantonese: "Cantonese", mandarin: "Mandarin" };
  const reviewChoices = { unit: "line", mode: "say" };
  let guideLanguage = "cantonese";
  let detachVoiceListener = () => {};

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function book() {
    const items = read(bookKey, []);
    return Array.isArray(items) ? items.filter(entry => entry?.id && entry.results) : [];
  }

  function save(entry) {
    if (!entry?.id || !entry.results) return false;
    const entries = book();
    const old = entries.findIndex(item => item.id === entry.id);
    if (old >= 0) entries[old] = entry;
    else entries.unshift(entry);
    return write(bookKey, entries);
  }

  function element(tag, value, className) {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  function button(label, action, className = "study-btn") {
    const node = element("button", label, className);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function link(label, url) {
    const node = element("a", label);
    node.href = url;
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function mascot(kind) {
    const art = svg("svg", {viewBox: "0 0 96 78", width: 80, height: 65, "aria-hidden": "true",
      fill: "none", stroke: "var(--ink)", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round"});
    const draw = (d, fill = "none") => art.append(svg("path", {d, fill}));
    if (kind === "frog") {
      draw("M13 48Q12 37 23 32Q21 16 32 14Q43 12 46 26Q54 24 60 27Q64 13 75 16Q85 18 81 34Q92 43 84 55Q70 67 46 64Q22 65 13 48Z", "var(--mint)");
      draw("M33 22l1 4m36-2 1 4M30 46q18 15 40-1");
      draw("M21 45l4-2m50 2 4-1", "var(--pink)");
    } else if (kind === "cat") {
      draw("M19 47L17 18Q18 13 22 17l18 10q10-4 20 0l17-13q4-3 4 2l-1 28q6 13-7 19q-10 6-29 5Q16 67 19 47Z", "var(--tan)");
      draw("M25 25l1 9 8-4m39-8-6 9 8 1M33 45q4-3 7 0m17-1q5-3 8 1M46 51l5 0-3 3Zm2 3q-4 6-9 2m9-2q3 5 8 1M28 51l-13-3m13 8-13 2m56-7 12-4m-11 9 12 1");
    } else {
      draw("M15 56q11-4 29-5l14-3q9-2 12-11q2-9 9-8q8 3 4 13q-3 8-7 13q-4 9-22 10l-33-1q-10 0-6-8Z", "var(--mint)");
      draw("M27 51Q19 38 26 26q7-14 23-11q16 3 18 19q1 14-7 20Z", "var(--pink)");
      draw("M33 45q-7-11 1-19q9-8 18 0q9 9 1 16q-7 5-12-1q-4-6 2-8q4-1 5 2M74 31l-2-12m10 12 5-12m-9 22q3 2 5-1");
      art.append(svg("circle",{cx:72,cy:18,r:2,fill:"var(--ink)"}),svg("circle",{cx:88,cy:18,r:2,fill:"var(--ink)"}));
    }
    return art;
  }

  function header(root, title, detail, animal) {
    const head = element("header", null, "study-head");
    const copy = element("div");
    copy.append(element("h1", title), element("p", detail));
    head.append(copy, mascot(animal));
    root.append(head);
  }

  function empty(root, title, detail, action) {
    const box = element("div", null, "study-card");
    box.append(element("h2", title), element("p", detail));
    if (action) box.append(action);
    root.append(box);
  }

  function languageText(text, language, className) {
    const node = element("span", text, className);
    node.lang = language === "cantonese" ? "yue" : "zh-CN";
    return node;
  }

  function phrasebook(root, hooks) {
    const entries = book();
    header(root, "Your phrasebook", "Saved on this browser. Open a phrase to hear it again.", "frog");
    if (!entries.length) {
      empty(root, "Your first page is waiting", "Make a phrase in the coach and it will appear here.",
        button("Make a phrase", () => hooks.navigate("coach"), "study-btn study-primary"));
      return;
    }
    const label = element("label", "Find a phrase", "study-label");
    const search = element("input", null, "study-search");
    search.type = "search";
    search.placeholder = "English, Chinese, or pronunciation";
    label.append(search);
    const list = element("div", null, "study-list");
    root.append(label, list);
    function update() {
      const term = search.value?.trim().toLocaleLowerCase() || "";
      list.replaceChildren();
      for (const entry of entries) {
        const versions = Object.entries(languages).filter(([name]) => entry.results[name]);
        const fields = [entry.english, ...versions.flatMap(([name]) => {
          const text = entry.results[name];
          return [text.hanzi, text.trad, text.jyutping];
        })];
        if (!fields.some(field => String(field ?? "").toLocaleLowerCase().includes(term))) continue;
        const tile = button("", () => hooks.reopen(entry), "study-card study-entry");
        tile.append(element("strong", entry.english), element("small", versions.map(([, name]) => name).join(" + ")));
        for (const [language] of versions) {
          const result = entry.results[language];
          const detail = element("div", null, "study-version");
          detail.append(languageText(result.hanzi, language), element("span", result.jyutping));
          tile.append(detail);
        }
        list.append(tile);
      }
      if (!list.children.length) empty(list, "No matching phrases", "Try a shorter search.");
    }
    search.addEventListener("input", update);
    update();
  }

  function studyCards(entries, unit) {
    const cards = new Map();
    for (const entry of entries) {
      for (const language of Object.keys(languages)) {
        const result = entry.results[language];
        if (!result) continue;
        const variants = [result, ...(entry.alternatives?.[language] || [])];
        for (const variant of variants) {
          const items = unit === "word" ? variant.words || [] : [variant];
          for (const item of items) {
            const prompt = unit === "word" ? item.meaning : variant === result ? entry.english : variant.back;
            if (!item.hanzi || !item.jyutping || !prompt) continue;
            const id = JSON.stringify([unit, language, item.hanzi, item.jyutping, prompt]);
            if (!cards.has(id)) cards.set(id, {id, language, hanzi:item.hanzi, reading:item.jyutping, prompt});
          }
        }
      }
    }
    return Array.from(cards.values());
  }

  function day(offset = 0, now = new Date()) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-");
  }

  function scheduleReview(cardId, previous, remembered, now = new Date()) {
    const box = remembered ? Math.min((previous?.box || 0) + 1, intervals.length - 1) : 0;
    return {cardId, box, due:day(intervals[box], now), completed:remembered ? day(0, now) : null};
  }

  function group(label, options, selected, onSelect) {
    const wrapper = element("div", null, "study-group");
    const heading = element("span", label, "study-label");
    const optionsEl = element("div", null, "study-pills");
    optionsEl.setAttribute("role","group");
    optionsEl.setAttribute("aria-label",label);
    for (const [value, text] of options) {
      const choice = button(text, () => onSelect(value));
      choice.setAttribute("aria-pressed", String(selected === value));
      optionsEl.append(choice);
    }
    wrapper.append(heading, optionsEl);
    return wrapper;
  }

  function review(root, hooks) {
    header(root, "Flashcards", "Practice the lines and words from your phrasebook.", "cat");
    const controls = element("div", null, "study-controls");
    const stage = element("section", null, "study-stage");
    const status = element("p", null, "study-count");
    status.setAttribute("aria-live", "polite");
    root.append(controls, status, stage);
    function setup() {
      hooks.stopAudio();
      controls.replaceChildren(
        group("Cards", [["line","Whole lines"],["word","Single words"]], reviewChoices.unit, unit => {
          reviewChoices.unit = unit; setup();
        }),
        group("Practice", [["say","Say it"],["listen","Listening"]], reviewChoices.mode, mode => {
          reviewChoices.mode = mode; setup();
        })
      );
      const all = studyCards(book(), reviewChoices.unit);
      const state = read(reviewKey, {});
      const mode = reviewChoices.mode;
      const recordKey = card => JSON.stringify([mode, card.id]);
      const due = all.filter(card => !state[recordKey(card)] || state[recordKey(card)].due <= day())
        .sort((a,b) => (state[recordKey(a)]?.due || day()).localeCompare(state[recordKey(b)]?.due || day()));
      function show() {
        stage.replaceChildren();
        const doneToday = new Set(Object.values(state).filter(record => record?.completed === day()).map(record => record.cardId)).size;
        status.textContent = doneToday + " done today · " + due.length + " due";
        if (!due.length) {
          if (all.length) {
            const next = all.map(card => state[recordKey(card)]?.due).filter(Boolean).sort()[0];
            empty(stage, "All caught up", next ? "Your next review is " + next + "." : "There are no more cards due today.");
          } else {
            empty(stage, "No cards yet", "Translate a line in the coach to start your deck.",
              button("Make a phrase", () => hooks.navigate("coach"), "study-btn study-primary"));
          }
          return;
        }
        const card = due[0];
        const panel = element("article", null, "study-card study-flash");
        const feedback = element("p", "", "study-feedback");
        feedback.setAttribute("role","status");
        async function hearCard() {
          try { await hooks.speak(card.hanzi, card.language); }
          catch { feedback.textContent = "Audio couldn’t play. Try again, or reveal the card to keep going."; }
        }
        const play = button("▶ Hear it", hearCard);
        panel.append(element("small", languages[card.language] + " · " + (reviewChoices.unit === "line" ? "Whole line" : "Single word")));
        panel.append(element("h2", mode === "say" ? card.prompt : "What do you hear?"));
        if (mode === "listen") panel.append(play);
        const reveal = button("Reveal answer", () => {
          reveal.remove();
          const answer = element("div", null, "study-answer");
          answer.append(languageText(card.hanzi, card.language, "study-hanzi"), element("p", card.reading));
          if (mode === "listen") answer.append(element("p", card.prompt));
          else answer.append(play);
          const ratings = element("div", null, "study-pills");
          function rate(remembered) {
            const key = recordKey(card);
            const fresh = read(reviewKey, {});
            const record = scheduleReview(card.id, fresh[key], remembered);
            if (!write(reviewKey, {...fresh, [key]:record})) {
              feedback.textContent = "This browser couldn’t save your review. Free up some site storage and try again.";
              return;
            }
            Object.assign(state, fresh, {[key]:record});
            due.shift();
            if (!remembered) due.push(card);
            hooks.stopAudio();
            show();
            stage.querySelector("button")?.focus({preventScroll:true});
          }
          ratings.append(button("Practice again", () => rate(false)), button("Got it", () => rate(true), "study-btn study-primary"));
          panel.append(answer, ratings);
          ratings.firstChild.focus({preventScroll:true});
        }, "study-btn study-primary");
        panel.append(reveal, feedback);
        stage.append(panel);
        if (mode === "listen") void hearCard();
      }
      show();
    }
    setup();
  }

  // Coordinates describe relative pitch: high sounds sit near the top of each card.
  const guides = {
    cantonese: {
      title: "Jyutping 101",
      intro: "Read the letters for the sound and the number for the tone. Try all six on si.",
      tag: "zh-HK",
      voice: "Cantonese (Hong Kong)",
      tones: [
        ["1", "High level", "诗", "si1", "poem", "M8 12 Q40 11 73 12T130 12"],
        ["2", "High rising", "史", "si2", "history", "M8 40 Q39 40 60 29T130 8"],
        ["3", "Mid level", "试", "si3", "try", "M8 31 Q41 30 72 31T130 31"],
        ["4", "Low falling", "时", "si4", "time", "M8 40 Q43 43 67 51T130 58"],
        ["5", "Low rising", "市", "si5", "market", "M8 54 Q44 54 67 45T130 30"],
        ["6", "Low level", "事", "si6", "matter", "M8 48 Q42 47 67 48T130 48"],
      ],
      pairs: [
        ["High rise or low rise?", "si2 climbs toward the top of your range. si5 begins lower and ends closer to the middle.", 1, 4],
        ["Which level?", "Hold both sounds steady. Keep si3 in the middle of your range, and place si6 lower.", 2, 5],
        ["Falling or level?", "Let si4 sink toward the bottom. Keep si6 on one low note.", 3, 5]
      ],
      spelling: [
        ["j", "Starts like the y in yes. 人 jan4 means person."],
        ["aa and a", "Hold aa longer and open your mouth wider. 三 saam1 is three. 心 sam1 is heart."],
        ["yu", "Say ee, then round your lips while keeping your tongue in place. 鱼 jyu4 means fish."],
        ["ng", "Start 我 ngo5 (I) with the sound at the end of sing."],
        ["-p, -t, -k", "Close the syllable cleanly. 食 sik6 (eat) ends with your tongue in position for k."],
        ["Final numbers", "The number belongs to the syllable before it. In 食饭 sik6 faan6 (eat a meal), both syllables stay low."]
      ],
      source: ["Jyutping reference", "https://lshk.org/jyutping-scheme/"]
    },
    mandarin: {
      title: "Pinyin 101",
      intro: "The mark over a vowel guides your pitch. Try the same syllable with each tone.",
      tag: "zh-CN",
      voice: "Mandarin (China mainland)",
      tones: [
        ["1", "High level", "妈", "mā", "mum", "M8 12 Q40 11 73 12T130 12"],
        ["2", "Rising", "麻", "má", "hemp", "M8 42 Q44 38 69 28T130 9"],
        ["3", "Low dipping", "马", "mǎ", "horse", "M8 38 Q36 61 63 55T130 16"],
        ["4", "Falling", "骂", "mà", "scold", "M8 10 Q42 18 67 31T130 59"],
        ["Light", "Neutral", "吗", "ma", "question particle", "M53 34q11-1 23 0"],
      ],
      pairs: [
        ["Rising or dipping?", "má starts in the middle and rises. mǎ starts lower, dips, and may rise at the end when said alone.", 1, 2],
        ["Level or falling?", "Hold mā high and even. For mà, begin high and drop in one movement.", 0, 3]
      ],
      spelling: [
        ["The four marks", "mā, má, mǎ, and mà show tones 1 to 4. An unmarked ma is short and unstressed. Its pitch depends on the syllable before it."],
        ["Two third tones", "你好 is written nǐ hǎo. In speech the first syllable rises, so you hear ní hǎo. Before most other tones a third tone usually stays low."],
        ["不 bù and 一 yī", "Before a fourth tone, 不 and 一 rise: 不对 bù duì sounds like bú duì. 一天 yī tiān sounds like yì tiān; 一次 yī cì sounds like yí cì."],
        ["ü", "Start with ee and round your lips. After j, q, x, or y the dots disappear, as in 鱼 yú (fish)."],
        ["q and x", "Keep the tip of your tongue near your lower teeth. q starts with a puff of air; x is a steady hiss."],
        ["-n and -ng", "For -n, touch the tongue tip behind your upper teeth. For -ng, lift the back of your tongue, as at the end of sing."]
      ],
      source: ["Mandarin tones reference", "https://web.mit.edu/jinzhang/www/pinyin/tones/"]
    }
  };

  function selectVoice(voices, language) {
    const isTarget = voice => {
      const tag = voice.lang.toLowerCase().replaceAll("_","-");
      if (language === "cantonese") return /^yue(?:-|$)/.test(tag) || /^zh-(?:(?:hant|hans)-)?hk(?:-|$)/.test(tag);
      return /^(?:zh|cmn)-(?:hans-)?cn(?:-|$)/.test(tag) || tag === "zh-hans";
    };
    const matches = voices.filter(isTarget);
    return matches.find(voice => voice.localService) || matches[0];
  }

  function toneSketch(path) {
    const plot = svg("svg", {viewBox:"0 0 140 68", "aria-hidden":"true", class:"study-curve", fill:"none"});
    for (const y of [12,32,52]) plot.append(svg("path", {d:"M4 "+y+" h132", stroke:"currentColor", opacity:".23", "stroke-dasharray":"3 5"}));
    plot.append(svg("path", {d:path, stroke:"currentColor", "stroke-width":4, "stroke-linecap":"round"}));
    return plot;
  }

  function guide(root, hooks, language) {
    guideLanguage = language;
    const info = guides[language];
    header(root, info.title, info.intro, "snail");
    const active = group("Tone guides", [["cantonese","Jyutping 101"],["mandarin","Pinyin 101"]], language, next => {
      if (next === language) return;
      render(next === "cantonese" ? "jyutping" : "pinyin", root, hooks);
      root.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    });
    root.append(active);
    const grid = element("div", null, "study-tiles");
    const voiceHint = element("p", null, "study-feedback");
    voiceHint.setAttribute("role","status");
    const install = element("details", null, "study-setup");
    install.append(element("summary","Set up a device voice"));
    install.append(element("p", "iPhone: Open Settings → Accessibility → Read & Speak (or Spoken Content) → Voices. Download " + info.voice + "."));
    install.append(element("p", "Android: In Settings, search for Text-to-speech output. Open your speech engine’s settings and choose Install voice data. Then return to the guide."));
    const help = element("p", null, "study-links");
    help.append(link("iPhone voice settings", "https://support.apple.com/guide/iphone/iph96b214f0/ios"),
      link("Android voice settings", "https://support.google.com/accessibility/android/answer/6006983"));
    install.append(help);
    const synth = window.speechSynthesis;
    function updateVoices() {
      const voice = selectVoice(synth?.getVoices() || [], language);
      voiceHint.textContent = voice ? "Tone samples use " + voice.name + " on this device." : "This browser hasn’t found a " + info.voice + " voice. Open the setup steps below to add one.";
      return voice;
    }
    function play(sample) {
      hooks.stopAudio();
      const voice = updateVoices();
      if (!voice || !window.SpeechSynthesisUtterance) {
        install.open = true;
        voiceHint.textContent = "Add a " + info.voice + " voice and reopen this guide to hear tone samples.";
        voiceHint.scrollIntoView?.({block:"nearest"});
        return;
      }
      const speech = new SpeechSynthesisUtterance(sample[2]);
      speech.lang = info.tag;
      speech.voice = voice;
      speech.rate = 0.85;
      speech.onerror = event => {
        if (!["canceled","interrupted"].includes(event.error)) voiceHint.textContent = "The device voice couldn’t play. Check your voice settings and try again.";
      };
      synth.cancel();
      synth.speak(speech);
    }
    updateVoices();
    if (synth?.addEventListener) {
      synth.addEventListener("voiceschanged", updateVoices);
      detachVoiceListener = () => { synth.removeEventListener("voiceschanged", updateVoices); };
    }
    root.append(element("h2","Tap a tone to hear it"));
    for (const tone of info.tones) {
      const [number, name, hanzi, reading, meaning, line] = tone;
      const cell = button("", () => play(tone), "study-tone");
      cell.setAttribute("aria-label", "Hear " + reading + ", " + name + ", " + meaning);
      const nameLine = element("span", null, "study-tonename");
      nameLine.append(element("strong",number === "Light" ? "Light" : "Tone " + number), element("span",name));
      const example = element("span", null, "study-example");
      example.append(languageText(hanzi, language), element("strong",reading), element("span",meaning));
      cell.append(nameLine, toneSketch(line), example);
      grid.append(cell);
    }
    root.append(grid, voiceHint, install);
    const pairs = element("div", null, "study-pairs");
    for (const [title, prose, left, right] of info.pairs) {
      const block = element("article", null, "study-card");
      block.append(element("h3",title), element("p",prose));
      const samples = element("div", null, "study-pills");
      for (const idx of [left, right]) {
        const tone = info.tones[idx];
        samples.append(button("▶ " + tone[3], () => play(tone)));
      }
      block.append(samples);
      pairs.append(block);
    }
    const cheats = element("dl", null, "study-cheats");
    for (const [key, detail] of info.spelling) cheats.append(element("dt",key), element("dd",detail));
    const ref = element("p",null,"study-links");
    ref.append(link(...info.source));
    root.append(element("h2","Tricky tone pairs"), pairs, element("h2","Spelling cheat sheet"), cheats, ref);
  }

  const css = `
    .study-panel { max-width: 830px; margin: 0 auto; color: var(--ink); }
    .study-panel * { box-sizing: border-box; }
    .study-panel h1, .study-panel h2, .study-panel h3 { color: var(--ink); font-family: var(--head); line-height: 1.08; }
    .study-panel h1 { font-size: clamp(2.5rem,7vw,3.75rem); margin:0; }
    .study-panel h2 { font-size: clamp(1.6rem,5vw,2.1rem); margin: 1.2em 0 .55em; }
    .study-panel h3 { font-size:1.35rem; margin:0; }
    .study-panel p { line-height:1.5; margin:.4em 0 1em; }
    .study-head { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin: 1.25rem 0; }
    .study-head svg { flex-shrink:0; transform:rotate(4deg); }
    .study-head p, .study-feedback, .study-label, .study-count, .study-version span:last-child { color:var(--muted); }
    .study-label, .study-count { display:block; font-weight:700; font-size:.92rem; }
    .study-panel button, .study-panel input { color:var(--ink); }
    .study-panel button { cursor:pointer; }
    .study-btn, .study-search, .study-tone, .study-card, .study-cheats, .study-setup {
      border:1.7px solid var(--line); border-radius:14px 11px 15px 10px; background:var(--card); color:var(--ink);
    }
    .study-btn { font:inherit; font-weight:700; line-height:1.15; min-height:44px; padding:.55rem .9rem; }
    .study-btn[aria-pressed="true"], .study-primary { background:var(--mint); border-color:var(--ink); box-shadow:2px 2px 0 var(--ink); }
    .study-panel button:focus-visible, .study-panel summary:focus-visible, .study-search:focus-visible { outline:3px solid currentColor; outline-offset:3px; }
    .study-search { display:block; width:100%; padding:.8rem 1rem; font:inherit; margin:.35rem 0 1rem; }
    .study-list, .study-pairs { display:grid; gap:.8rem; }
    .study-card { padding: 1rem 1.2rem; }
    .study-card h2 { margin:.1em 0 .4em; }
    .study-entry { text-align:left; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.35rem .8rem; font:inherit; }
    .study-entry strong, .study-version, .study-flash { overflow-wrap:anywhere; }
    .study-entry small, .study-flash small { color:var(--muted); font-weight:750; }
    .study-version { grid-column:1/-1; display:flex; gap:.6rem; align-items:baseline; flex-wrap:wrap; }
    .study-pills, .study-controls { display:flex; gap:.55rem; flex-wrap:wrap; align-items:center; }
    .study-controls { gap:1rem 2rem; }
    .study-group { margin:.35rem 0 .85rem; } .study-group .study-label { margin-bottom:.45rem; }
    .study-stage { margin-top:.7rem; }
    .study-flash { text-align:center; padding:clamp(1rem,6vw,3rem); background:var(--card); border-color:var(--ink); box-shadow:3px 4px 0 var(--line); }
    .study-flash > .study-btn { margin:.3rem; }
    .study-flash h2 { margin:1rem 0; }
    .study-flash .study-pills { justify-content:center; margin-top:1.25rem; }
    .study-answer { padding:1rem 0; border-top:1px dashed var(--line); }
    .study-hanzi { font-size:1.75rem; } .study-answer p { margin:.4rem 0; }
    .study-feedback:empty { display:none; }
    .study-tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(146px,100%),1fr)); gap:.65rem; }
    .study-tone { font:inherit; padding:.6rem; min-width:0; text-align:left; }
    .study-tone:nth-child(3n+1) {background:var(--mint);} .study-tone:nth-child(3n+2) {background:var(--tan);} .study-tone:nth-child(3n) {background:var(--blue);}
    .study-tonename {display:grid;gap:.1rem;} .study-tonename span, .study-example span:last-child {font-size:.87rem;}
    .study-curve { width:100%; height:52px; display:block; margin:.2rem auto; }
    .study-example {display:flex; align-items:baseline; flex-wrap:wrap; gap:.3rem;}
    .study-example > :first-child {font-size:1.3rem;}
    .study-setup { padding:.65rem .8rem; } .study-setup summary { cursor:pointer; font-weight:700; }
    .study-setup p { margin:.6rem 0; } .study-pairs { grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr)); }
    .study-cheats {padding:.4rem 1rem; margin:0;} .study-cheats dt {font-weight:800; padding-top:.65rem;}
    .study-cheats dd {margin:.25rem 0 0; padding-bottom:.65rem; border-bottom:1px dashed var(--line);}
    .study-cheats dd:last-child {border:0;} .study-links {display:flex;flex-wrap:wrap;gap:.6rem;} .study-links a {color:var(--ink); text-underline-offset:.2em;}
    @media(max-width:410px) {.study-head svg{width:54px;height:48px;} .study-card{padding:.85rem;} .study-entry{grid-template-columns:1fr;}}
  `;

  function render(view, root, hooks) {
    detachVoiceListener(); detachVoiceListener = () => {};
    if (!document.getElementById("kapok-study-style")) {
      const style = element("style", css);
      style.id = "kapok-study-style";
      document.head.append(style);
    }
    root.classList.add("study-panel");
    root.replaceChildren();
    if (view === "phrasebook") phrasebook(root, hooks);
    else if (view === "review") review(root, hooks);
    else guide(root, hooks, view === "pinyin" ? "mandarin" : view === "jyutping" ? "cantonese" : guideLanguage);
  }

  window.Study = Object.freeze({save, render, studyCards, scheduleReview});
})();
