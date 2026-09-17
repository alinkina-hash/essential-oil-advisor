// Пересобирает data/oils_data.js из сырых данных в data/raw/*.json
// Запуск: node scripts/merge.js

const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, '..', 'data', 'raw');
const outPath = path.join(__dirname, '..', 'data', 'oils_data.js');

const doterra = JSON.parse(fs.readFileSync(path.join(rawDir, 'doterra_oils.json'), 'utf8'));
const kundalini = JSON.parse(fs.readFileSync(path.join(rawDir, 'kundalini_oils.json'), 'utf8'));
const kalmykova = JSON.parse(fs.readFileSync(path.join(rawDir, 'kalmykova_notes.json'), 'utf8'));
const additional = JSON.parse(fs.readFileSync(path.join(rawDir, 'additional_oils.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(rawDir, 'sources.json'), 'utf8'));

// Масла и смеси, которые сейчас есть в наличии — редактируй эти списки при пополнении коллекции
const inStockSingles = new Set([
  'clove','cinnamon-bark','grapefruit','wild-orange','lime','bergamot','lemon','clementine',
  'melaleuca','cedarwood','siberian-fir','wintergreen','coriander','oregano','geranium',
  'cypress','frankincense','copaiba','cassia','patchouli','helichrysum','lavender',
  'lemongrass','sandalwood','peppermint','eucalyptus'
]);
const inStockBlends = new Set([
  'on-guard','zendocrine','digestzen','breathe','balance','aromatouch','deep-blue','whisper'
]);

const oils = doterra.oils.map(o => ({
  ...o,
  brand: 'doTERRA',
  in_stock: inStockSingles.has(o.id) || inStockBlends.has(o.id)
}));

// doTERRA продаёт Клементин как отдельное цитрусовое масло в некоторых регионах —
// в исследованный каталог не попало, но есть в коллекции, поэтому добавлено вручную.
if (!oils.some(o => o.id === 'clementine')) {
  oils.push({
    id: 'clementine',
    name_en: 'Clementine',
    name_ru: 'Клементин',
    latin: 'Citrus clementina',
    type: 'single',
    brand: 'doTERRA',
    in_stock: true,
    tags: ['энергия', 'сон', 'стресс'],
    properties: 'Сладкое, мягкое цитрусовое масло, более нежное и менее терпкое, чем Дикий апельсин или Мандарин. Используется для поднятия настроения, создания лёгкой, радостной атмосферы и как приятный аромат перед сном для всей семьи.',
    aromatic_use: 'Диффузор для лёгкого сладкого цитрусового аромата в течение дня или перед сном.',
    topical_use: 'Хорошо переносится большинством кожи в разведении 1:1.',
    internal_use: 'Как и другие цитрусовые доTERRA, обычно имеет Supplement Facts — можно добавлять в воду/десерты; проверяйте этикетку конкретной бутылки.',
    safety_notes: 'ФОТОСЕНСИБИЛИЗИРУЮЩЕЕ (как и прочие холоднопрессованные цитрусовые) — избегать солнца/УФ минимум 12 часов после нанесения на кожу. При беременности использовать с осторожностью.'
  });
}

const kundaliniOils = kundalini.map(o => ({ ...o, in_stock: true }));

// Растения, которые упоминает травница Светлана Калмыкова, но которых нет в каталоге
// doTERRA/Kundalini Aroma — добавлены целиком по её просьбе ("добавь все масла, которые
// она упоминает, даже если их у меня нет"). in_stock всегда false, т.к. этих масел
// у пользовательницы нет физически.
const additionalOils = additional.map(o => ({ ...o, in_stock: false }));

const allOils = [...oils, ...kundaliniOils, ...additionalOils];

// Прикрепляем личные заметки Светланы Калмыковой к соответствующим маслам по id.
// Одно масло может встречаться в нескольких цитатах — собираем их в массив.
const notesByOil = {};
for (const note of kalmykova.antiparasitic_protocol.personal_oil_notes) {
  (notesByOil[note.oil_id] = notesByOil[note.oil_id] || []).push(note.quote);
}
for (const oil of allOils) {
  if (notesByOil[oil.id]) {
    oil.notes_kalmykova = notesByOil[oil.id];
  }
}

// Прикрепляем упоминания масла в таблицах "гормон -> масла" и в разделе про фертильность —
// иначе они видны только на отдельной странице "Заметки травницы", а не на карточке масла.
const hormoneNotesByOil = {};
for (const h of kalmykova.hormones) {
  for (const item of h.items) {
    for (const oilId of item.oils || []) {
      (hormoneNotesByOil[oilId] = hormoneNotesByOil[oilId] || []).push({ hormone: h.hormone, text: item.text });
    }
  }
}
for (const oilId of kalmykova.fertility.oils_mentioned || []) {
  (hormoneNotesByOil[oilId] = hormoneNotesByOil[oilId] || []).push({ hormone: kalmykova.fertility.title, text: kalmykova.fertility.text });
}
for (const oil of allOils) {
  if (hormoneNotesByOil[oil.id]) {
    oil.hormone_notes_kalmykova = hormoneNotesByOil[oil.id];
    // Добавляем тег "гормоны", чтобы такие масла можно было находить через фильтр-чипы.
    oil.tags = [...new Set([...(oil.tags || []), 'гормоны'])];
  }
}

// Общие способы применения из курса по женскому здоровью (капли в паховую складку, рефлекторные
// точки, диффузор, ванна и т.д.) относятся не к одному маслу, а ко всем маслам из этого курса —
// прикрепляем их к каждому маслу, упомянутому в таблицах гормонов или в разделе про фертильность.
const womensHealthOilIds = new Set([
  ...Object.keys(hormoneNotesByOil),
  ...(kalmykova.fertility.oils_mentioned || [])
]);
for (const oil of allOils) {
  if (womensHealthOilIds.has(oil.id)) {
    oil.general_application_kalmykova = kalmykova.application_methods_general;
  }
}

// Прикрепляем упоминания масла в её протокольных списках (замасливание пупка, полоскание рта,
// общий список антипаразитарных масел) — иначе они тоже видны только на отдельной странице.
const ap = kalmykova.antiparasitic_protocol;
const protocolNotesByOil = {};
function addProtocolNote(oilId, text) {
  (protocolNotesByOil[oilId] = protocolNotesByOil[oilId] || []).push(text);
}
for (const id of ap.oiling_antiparasitic.best_oils_for_navel_ids) {
  addProtocolNote(id, '«Замасливание» пупочной зоны в антипаразитарном протоколе — базовое масло с каплей этого эфирного.');
}
for (const id of ap.mouth_rinse.variant_3_base_plus_essential.essential_oils_ids) {
  addProtocolNote(id, 'Один из вариантов для полоскания рта: 1 чайная ложка базового масла + 1-2 капли этого эфирного.');
}
for (const id of ap.antiparasitic_oils_list.matched_ids) {
  addProtocolNote(id, 'В общем списке антипаразитарных эфирных масел из её курса.');
}
for (const oil of allOils) {
  if (protocolNotesByOil[oil.id]) {
    // без дублей на случай, если масло попало в несколько списков одинаковым текстом
    oil.protocol_notes_kalmykova = [...new Set(protocolNotesByOil[oil.id])];
  }
}

const merged = {
  general_safety: doterra.general_safety,
  kalmykova_notes: kalmykova,
  sources: sources,
  oils: allOils
};

fs.writeFileSync(outPath, 'const OILS_DATA = ' + JSON.stringify(merged, null, 2) + ';\n');

console.log('Всего масел:', merged.oils.length);
console.log('В наличии:', merged.oils.filter(o => o.in_stock).length);
console.log('Записано в', outPath);
