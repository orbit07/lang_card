const STORAGE_KEY = 'koreanFlashcards';
const TAG_STORAGE_KEY = 'koreanFlashcardTags';

const elements = {
  modeSelect: document.getElementById('modeSelect'),
  excludeChecked: document.getElementById('excludeChecked'),
  tagFilterContainer: document.getElementById('tagFilterContainer'),
  card: document.getElementById('card'),
  frontText: document.getElementById('frontText'),
  backText: document.getElementById('backText'),
  frontNote: document.getElementById('frontNote'),
  backMemo: document.getElementById('backMemo'),
  cardCounter: document.getElementById('cardCounter'),
  frontHint: document.getElementById('frontHint'),
  hintMask: document.querySelector('#frontHint .hint-mask'),
  hintText: document.querySelector('#frontHint .hint-text'),
  backTags: document.getElementById('backTags'),
  cardTags: document.getElementById('cardTags'),
  checkButton: document.getElementById('checkButton'),
  frontSpeak: document.getElementById('frontSpeak'),
  backSpeak: document.getElementById('backSpeak'),
  prevCard: document.getElementById('prevCard'),
  nextCard: document.getElementById('nextCard'),
  toggleSide: document.getElementById('toggleSide'),
  emptyMessage: document.getElementById('emptyMessage'),
  resetProgress: document.getElementById('resetProgress'),
  cardForm: document.getElementById('cardForm'),
  cardId: document.getElementById('cardId'),
  frontInput: document.getElementById('frontInput'),
  backInput: document.getElementById('backInput'),
  frontNoteInput: document.getElementById('frontNoteInput'),
  frontHintInput: document.getElementById('frontHintInput'),
  backMemoInput: document.getElementById('backMemoInput'),
  cancelEdit: document.getElementById('cancelEdit'),
  cardList: document.getElementById('cardList'),
  totalCards: document.getElementById('totalCards'),
  cardRowTemplate: document.getElementById('cardRowTemplate'),
  newTagInput: document.getElementById('newTagInput'),
  addTagButton: document.getElementById('addTagButton'),
  cardTagOptions: document.getElementById('cardTagOptions'),
};

let cards = [];
let tagLibrary = [];
let activeCardIds = [];
let currentIndex = 0;
let showingBack = false;
let selectedFilters = new Set();

const speechState = {
  voices: [],
  listening: false,
};
const SAMPLE_DATA = [
  {
    id: crypto.randomUUID?.() ?? `card-${Date.now()}`,
    frontText: '안녕하세요',
    backText: 'こんにちは',
    frontNote: '丁寧な挨拶',
    frontHint: '初対面の挨拶はこれでOK',
    backMemo: '親しい相手にも使える定番表現',
    tags: ['あいさつ'],
    checked: false,
    createdAt: Date.now(),
  },
  {
    id: `card-${Date.now() + 1}`,
    frontText: '어디에 가요?',
    backText: 'どこに行きますか？',
    frontNote: '旅行会話',
    frontHint: '어디=どこ / 가다=行く',
    backMemo: '語尾-에 가요? で「〜に行きますか」',
    tags: ['旅行', '質問'],
    checked: false,
    createdAt: Date.now() + 1,
  },
  {
    id: `card-${Date.now() + 2}`,
    frontText: '괜찮아요',
    backText: '大丈夫です／問題ありません',
    frontNote: '感謝にも返答にも',
    frontHint: '謝罪にも返答にも使える',
    backMemo: '様々な場面で万能',
    tags: ['便利表現'],
    checked: false,
    createdAt: Date.now() + 2,
  },
];

const normalizeCard = (card, index = 0) => ({
  id: card.id || `card-${Date.now()}-${index}`,
  frontText: card.frontText || '',
  backText: card.backText || '',
  frontNote: card.frontNote ?? card.frontMemo ?? '',
  frontHint: card.frontHint ?? '',
  backMemo: card.backMemo ?? '',
  tags: Array.isArray(card.tags) ? card.tags : [],
  checked: Boolean(card.checked),
  createdAt: card.createdAt ?? Date.now() + index,
});

const loadData = () => {
  const savedCards = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  const savedTags = JSON.parse(localStorage.getItem(TAG_STORAGE_KEY) || 'null');

  if (Array.isArray(savedCards) && savedCards.length) {
    cards = savedCards.map((card, index) => normalizeCard(card, index));
  } else {
    cards = SAMPLE_DATA.map((card, index) => normalizeCard(card, index));
    persistCards();
  }

  if (Array.isArray(savedTags) && savedTags.length) {
    tagLibrary = savedTags;
  } else {
    tagLibrary = Array.from(new Set(cards.flatMap((c) => c.tags)));
    persistTags();
  }

  syncTagsFromCards();
};

const persistCards = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
};

const persistTags = () => {
  localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tagLibrary));
};

const syncTagsFromCards = () => {
  const all = new Set(tagLibrary);
  cards.forEach((card) => card.tags.forEach((tag) => all.add(tag)));
  tagLibrary = Array.from(all);
  persistTags();
};

const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const updateActiveCards = () => {
  const filtered = cards.filter((card) => {
    if (elements.excludeChecked.checked && card.checked) {
      return false;
    }
    if (selectedFilters.size === 0) {
      return true;
    }
    return Array.from(selectedFilters).every((tag) => card.tags.includes(tag));
  });

  const ids = filtered.map((card) => card.id);
  activeCardIds = elements.modeSelect.value === 'random' ? shuffle(ids) : ids;

  if (currentIndex >= activeCardIds.length) {
    currentIndex = 0;
  }

  if (activeCardIds.length === 0) {
    elements.card.classList.add('empty');
    showingBack = false;
  } else {
    elements.card.classList.remove('empty');
  }

  renderCard();
  renderCardList();
};

const currentCard = () => cards.find((card) => card.id === activeCardIds[currentIndex]);

const renderCard = () => {
  const card = currentCard();
  const total = activeCardIds.length;
  const position = total ? currentIndex + 1 : 0;
  elements.cardCounter.textContent = `${position} / ${total}`;

  if (!card) {
    elements.frontText.textContent = 'カードがありません';
    elements.backText.textContent = '';
    elements.frontNote.textContent = '';
    elements.backMemo.textContent = '';
    elements.cardTags.textContent = '';
    elements.backTags.innerHTML = '';
    elements.frontHint.classList.remove('revealed');
    elements.hintText.textContent = '';
    elements.checkButton.disabled = true;
    return;
  }

  elements.checkButton.disabled = false;
  elements.frontText.textContent = card.frontText;
  elements.backText.textContent = card.backText;
  elements.frontNote.textContent = card.frontNote || '';
  elements.backMemo.textContent = card.backMemo || '';
  elements.hintText.textContent = card.frontHint || 'ヒントは設定されていません';
  elements.frontHint.classList.toggle('hidden', !card.frontHint);
  elements.frontHint.classList.toggle('revealed', false);
  elements.cardTags.textContent = card.tags.length ? `タグ: ${card.tags.join(', ')}` : '';
  elements.backTags.innerHTML = card.tags
    .map((tag) => `<span>${tag}</span>`)
    .join('');
  elements.checkButton.textContent = card.checked ? '✓ 覚えたカード' : '覚えた！';
  elements.checkButton.classList.toggle('checked', card.checked);

  elements.card.classList.toggle('show-back', showingBack);
};

const refreshVoices = () => {
  if (!window.speechSynthesis) return [];
  const list = window.speechSynthesis.getVoices();
  if (list.length) {
    speechState.voices = list;
  }
  return list;
};

const subscribeVoiceChanges = () => {
  if (!window.speechSynthesis || speechState.listening) return;
  speechState.listening = true;
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
};

const waitForVoices = () => {
  if (!window.speechSynthesis) return Promise.resolve([]);
  if (speechState.voices.length) return Promise.resolve(speechState.voices);
  if (!speechState.voiceReadyPromise) {
    speechState.voiceReadyPromise = new Promise((resolve) => {
      const attempt = () => {
        const list = refreshVoices();
        if (list.length) {
          speechState.voiceReadyPromise = null;
          resolve(list);
          return true;
        }
        return false;
      };

      if (attempt()) return;

      const timer = setInterval(() => {
        if (attempt()) {
          clearInterval(timer);
        }
      }, 150);

      setTimeout(() => {
        clearInterval(timer);
        speechState.voiceReadyPromise = null;
        resolve(speechState.voices);
      }, 1500);
    });
  }

  return speechState.voiceReadyPromise;
};

const getVoiceForLang = (lang) => {
  if (!speechState.voices.length) return null;
  const normalized = lang.toLowerCase();
  const base = normalized.split('-')[0];
  return (
    speechState.voices.find((voice) => voice.lang?.toLowerCase() === normalized) ||
    speechState.voices.find((voice) => voice.lang?.toLowerCase().startsWith(base)) ||
    null
  );
};

const speakText = (text, lang = 'ko-KR') => {
  if (!window.speechSynthesis || !text) return;
  subscribeVoiceChanges();
  refreshVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getVoiceForLang(lang);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = lang;
    utterance.pitch = 1.8;
    utterance.rate = 1.2;
    const voice = getVoiceForLang(lang);
    if (voice) {
      utterance.voice = voice;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
};

const toggleSide = () => {
  if (!activeCardIds.length) return;
  showingBack = !showingBack;
  elements.card.classList.toggle('show-back', showingBack);
};

const goTo = (direction) => {
  if (!activeCardIds.length) return;
  currentIndex = (currentIndex + direction + activeCardIds.length) % activeCardIds.length;
  showingBack = false;
  renderCard();
};

const resetForm = () => {
  elements.cardId.value = '';
  elements.cardForm.reset();
  Array.from(elements.cardTagOptions.querySelectorAll('input')).forEach((input) => {
    input.checked = false;
  });
};

const renderTagFilters = () => {
  if (!tagLibrary.length) {
    elements.tagFilterContainer.innerHTML = '<p class="small">タグはまだ登録されていません</p>';
    elements.cardTagOptions.innerHTML = '<p class="small">タグを追加して選択できます</p>';
    return;
  }

  elements.tagFilterContainer.innerHTML = tagLibrary
    .map(
      (tag) => `
        <label>
          <input type="checkbox" value="${tag}" ${selectedFilters.has(tag) ? 'checked' : ''} />
          <span>${tag}</span>
        </label>
      `
    )
    .join('');

  elements.cardTagOptions.innerHTML = tagLibrary
    .map(
      (tag) => `
        <label>
          <input type="checkbox" name="cardTag" value="${tag}" />
          <span>${tag}</span>
        </label>
      `
    )
    .join('');
};

const renderCardList = () => {
  elements.totalCards.textContent = `${cards.length}件`;
  elements.cardList.innerHTML = '';

  if (!cards.length) {
    elements.cardList.innerHTML = '<p class="small">カードを登録するとここに表示されます。</p>';
    return;
  }

  cards.forEach((card) => {
    const clone = elements.cardRowTemplate.content.cloneNode(true);
    clone.querySelector('.row-front').textContent = `表: ${card.frontText}`;
    clone.querySelector('.row-back').textContent = `裏: ${card.backText}`;
    const tags = clone.querySelector('.row-tags');
    tags.innerHTML = card.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join('');
    const row = clone.querySelector('.card-row');
    row.dataset.id = card.id;
    const editButton = clone.querySelector('[data-action="edit"]');
    const deleteButton = clone.querySelector('[data-action="delete"]');
    editButton.addEventListener('click', () => startEdit(card.id));
    deleteButton.addEventListener('click', () => deleteCard(card.id));
    elements.cardList.appendChild(clone);
  });
};

const startEdit = (cardId) => {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;
  elements.cardId.value = card.id;
  elements.frontInput.value = card.frontText;
  elements.backInput.value = card.backText;
  elements.frontNoteInput.value = card.frontNote || '';
  elements.frontHintInput.value = card.frontHint || '';
  elements.backMemoInput.value = card.backMemo || '';
  Array.from(elements.cardTagOptions.querySelectorAll('input')).forEach((input) => {
    input.checked = card.tags.includes(input.value);
  });
  elements.frontInput.focus();
};

const deleteCard = (cardId) => {
  if (!confirm('このカードを削除しますか？')) return;
  cards = cards.filter((card) => card.id !== cardId);
  persistCards();
  updateActiveCards();
};

const upsertCard = (event) => {
  event.preventDefault();
  const formData = new FormData(elements.cardForm);
  const id = formData.get('cardId');
  const payload = {
    id: id || crypto.randomUUID?.() || `card-${Date.now()}`,
    frontText: formData.get('frontText').trim(),
    backText: formData.get('backText').trim(),
    frontNote: formData.get('frontNote').trim(),
    frontHint: formData.get('frontHint').trim(),
    backMemo: formData.get('backMemo').trim(),
    tags: Array.from(elements.cardTagOptions.querySelectorAll('input:checked')).map((el) => el.value),
    checked: id ? cards.find((card) => card.id === id)?.checked ?? false : false,
    createdAt: id ? cards.find((card) => card.id === id)?.createdAt ?? Date.now() : Date.now(),
  };

  if (!payload.frontText || !payload.backText) {
    alert('表面と裏面のフレーズは必須です');
    return;
  }

  if (id) {
    cards = cards.map((card) => (card.id === id ? payload : card));
  } else {
    cards = [...cards, payload];
  }

  persistCards();
  resetForm();
  updateActiveCards();
};

const toggleCheck = () => {
  const card = currentCard();
  if (!card) return;
  card.checked = !card.checked;
  persistCards();
  if (elements.excludeChecked.checked) {
    updateActiveCards();
  } else {
    renderCard();
    renderCardList();
  }
};

const addTag = () => {
  const value = elements.newTagInput.value.trim();
  if (!value) return;
  if (tagLibrary.includes(value)) {
    alert('既に登録されているタグです');
    return;
  }
  tagLibrary.push(value);
  persistTags();
  elements.newTagInput.value = '';
  renderTagFilters();
};

const attachListeners = () => {
  elements.modeSelect.addEventListener('change', updateActiveCards);
  elements.excludeChecked.addEventListener('change', updateActiveCards);
  elements.tagFilterContainer.addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      const tag = event.target.value;
      if (event.target.checked) {
        selectedFilters.add(tag);
      } else {
        selectedFilters.delete(tag);
      }
      updateActiveCards();
    }
  });
  elements.frontSpeak.addEventListener('click', (event) => {
    event.stopPropagation();
    speakText(currentCard()?.frontText, 'ko-KR');
  });
  elements.backSpeak.addEventListener('click', (event) => {
    event.stopPropagation();
    speakText(currentCard()?.backText, 'ko-KR');
  });
  elements.checkButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleCheck();
  });
  elements.prevCard.addEventListener('click', (event) => {
    event.stopPropagation();
    goTo(-1);
  });
  elements.nextCard.addEventListener('click', (event) => {
    event.stopPropagation();
    goTo(1);
  });
  elements.toggleSide.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSide();
  });
  elements.card.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    toggleSide();
  });
  elements.card.addEventListener('touchstart', handleTouchStart, { passive: true });
  elements.card.addEventListener('touchend', handleTouchEnd, { passive: true });
  elements.frontHint.addEventListener('click', (event) => {
    if (elements.frontHint.classList.contains('hidden')) return;
    event.stopPropagation();
    elements.frontHint.classList.toggle('revealed');
  });
  elements.resetProgress.addEventListener('click', () => {
    if (!confirm('全てのチェックを外しますか？')) return;
    cards = cards.map((card) => ({ ...card, checked: false }));
    persistCards();
    renderCard();
  });
  elements.cardForm.addEventListener('submit', upsertCard);
  elements.cancelEdit.addEventListener('click', resetForm);
  elements.addTagButton.addEventListener('click', addTag);
};

let touchStartX = 0;
const handleTouchStart = (event) => {
  touchStartX = event.changedTouches[0].screenX;
};

const handleTouchEnd = (event) => {
  const delta = event.changedTouches[0].screenX - touchStartX;
  if (Math.abs(delta) < 40) return;
  if (delta > 0) {
    goTo(-1);
  } else {
    goTo(1);
  }
};

const primeSpeechOnFirstInteraction = () => {
  if (!window.speechSynthesis) return;
  const warmup = () => {
    subscribeVoiceChanges();
    refreshVoices();
  };
  const handler = () => {
    warmup();
    document.removeEventListener('touchstart', handler, true);
    document.removeEventListener('mousedown', handler, true);
    document.removeEventListener('keydown', handler, true);
  };
  document.addEventListener('touchstart', handler, true);
  document.addEventListener('mousedown', handler, true);
  document.addEventListener('keydown', handler, true);
};

const init = () => {
  loadData();
  renderTagFilters();
  attachListeners();
  primeSpeechOnFirstInteraction();
  updateActiveCards();
};

init();
