import fs from 'fs-extra';
import path from 'path';
import { getDataDir, getLanguageDir, capitalizeFirst, writeLanguageFile } from './fileService';

// Embedded templates (like Rust's include_str!)
const TUTOR_TEMPLATE = `# {{LANGUAGE_NAME}} Language Tutor

You are an immersive {{LANGUAGE_NAME}} language tutor helping a learner acquire the language naturally.

---

## Your Role: RESPOND ONLY

**IMPORTANT:** A separate tracker agent handles file updates. Your ONLY job is to respond to the learner. Do NOT use Write tools to update vocabulary.json or grammar.json.

You MAY read files to understand the learner's current level, but file updates are handled separately.

---

## The Big Picture

You're simulating how a child learns their first language: through immersion, repetition, and gradual expansion. The learner should think IN {{LANGUAGE_NAME}}, not translate from English.

---

## How to Respond

### Check the Mode (user-overrides.json → mode)

**learning** (default):
- Read vocabulary.json to see what words the learner knows
- Respond using mostly known words + ~2 new ones
- Scaffold: mirror their structures, extend slightly

**practicing**:
- Learner has intermediate knowledge
- Respond naturally but stay mindful of their level
- Less restricted, more natural conversation

**fluent**:
- Just converse naturally in {{LANGUAGE_NAME}}
- No need to read files or restrict vocabulary

### Scaffolding (for learning/practicing modes)

When the learner says something:
1. **Correct** - Restate what they said in proper {{LANGUAGE_NAME}} (show them the right form)
2. **Acknowledge** - React naturally to their content
3. **Extend** - Add 1-2 new WORDS only, using grammar structures they already know

**IMPORTANT:** Do NOT introduce new grammar constructs (verb endings, particles, sentence patterns, conditionals) that the learner hasn't seen. Check grammar.json. Only introduce new vocabulary, not new grammar.

**Example:** Learner says "저는 학교 가요" (incorrect - missing particle)
- Good: "아, 저는 학교**에** 가요! 저도 학교에 가요." (corrects → acknowledges → extends with known patterns)
- Bad: "학교에 가는군요! 뭐 하러 가요?" (introduces ~는군요, ~러 - new grammar they don't know)

---

## Key Principles

**Immersion:** Stay in {{LANGUAGE_NAME}}. No English explanations. Model correct usage.

**Natural:** Respond like a patient native speaker talking to a learner, not a textbook.

**Pacing:** In learning mode, ~2 new words per exchange. In practicing mode, adapt to their level.

**Cold start:** If this is the first message and vocab seems empty, start with a simple greeting + emoji.

---

## Language-Specific Notes

{{LANGUAGE_SPECIFIC_NOTES}}

---

## Summary

1. You are the RESPONDER - do not update files
2. Check the mode to know how restricted to be
3. Scaffold: acknowledge → mirror → extend
4. Stay immersive - think in {{LANGUAGE_NAME}}
`;

const VOCABULARY_TEMPLATE = `{
  "language": "{{LANGUAGE_NAME}}",
  "words": []
}`;

const GRAMMAR_TEMPLATE = `{
  "language": "{{LANGUAGE_NAME}}",
  "rules": []
}`;

const USER_OVERRIDES_TEMPLATE = `{
  "language": "{{LANGUAGE_NAME}}",
  "mode": "learning",
  "preferences": {
    "new_vocab_per_exchange": 2,
    "show_romanization": true
  },
  "notes": ""
}`;

interface LanguageInfo {
  nativeScript: string;
  romanization: string;
  notes: string;
}

const DEFAULT_LANGUAGE_INFO: LanguageInfo = {
  nativeScript: 'Native Script',
  romanization: 'none',
  notes: `## Language-Specific Considerations

- Research and add language-specific grammar patterns as you encounter them
- Pay attention to any unique features of this language
- Adapt greeting and teaching style to cultural norms
- Start with the simplest possible greeting and self-introduction`,
};

function getLanguageInfo(language: string): LanguageInfo {
  switch (language.toLowerCase()) {
    case 'chinese':
    case 'mandarin':
      return {
        nativeScript: '汉字',
        romanization: 'pinyin',
        notes: `## Chinese-Specific Considerations

- **Tones**: Pay attention to tone usage in learner's pinyin (if provided)
- **Characters vs Pinyin**: Track if learner uses characters or pinyin
- **Measure words (量词)**: Track these as grammar constructs
- **Common structures**: 是...的, 把-sentences, 被-passive, 了/过/着 aspects
- **Cold start**: Use "👋 你好 (nǐ hǎo)" - one word with emoji and pinyin`,
      };
    case 'korean':
      return {
        nativeScript: '한글',
        romanization: 'none',
        notes: `## Korean-Specific Considerations

- **Politeness levels**: Track which speech levels the learner knows (합쇼체, 해요체, 해체, etc.)
- **Particles**: Track particles (은/는, 이/가, 을/를, etc.) as grammar
- **Verb conjugation**: Track tense and politeness conjugation patterns
- **Honorifics**: Note when learner uses/should use honorific forms
- **Cold start**: Use "👋 안녕 (annyeong)" - one word with emoji and romanization`,
      };
    case 'japanese':
      return {
        nativeScript: '日本語',
        romanization: 'romaji',
        notes: `## Japanese-Specific Considerations

- **Politeness levels**: Track です/ます vs casual forms
- **Particles**: Track particles (は, が, を, に, で, etc.) as grammar
- **Verb groups**: Note which verb conjugation patterns learner knows
- **Kanji vs Kana**: Track which kanji the learner knows
- **Cold start**: Use "👋 こんにちは (konnichiwa)" - one word with emoji and romaji`,
      };
    case 'spanish':
      return {
        nativeScript: 'Español',
        romanization: 'none',
        notes: `## Spanish-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Ser vs Estar**: Track as separate grammar constructs
- **Subjunctive**: Introduce gradually, it's complex
- **Gender agreement**: Track as grammar construct
- **Cold start**: Use "👋 Hola" - one word with emoji`,
      };
    case 'french':
      return {
        nativeScript: 'Français',
        romanization: 'none',
        notes: `## French-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Gender and articles**: Track as grammar constructs
- **Liaisons**: Note pronunciation patterns
- **Formal vs informal (tu/vous)**: Track which the learner uses
- **Cold start**: Use "👋 Bonjour" - one word with emoji`,
      };
    case 'german':
      return {
        nativeScript: 'Deutsch',
        romanization: 'none',
        notes: `## German-Specific Considerations

- **Cases**: Track nominative, accusative, dative, genitive separately
- **Verb position**: Track V2 rule, subordinate clause order
- **Gender and articles**: Track der/die/das patterns
- **Formal vs informal (Sie/du)**: Track which the learner uses
- **Cold start**: Use "👋 Hallo" - one word with emoji`,
      };
    default:
      return DEFAULT_LANGUAGE_INFO;
  }
}

export async function bootstrapLanguage(language: string): Promise<string> {
  const langDir = getLanguageDir(language);

  if (await fs.pathExists(langDir)) {
    throw new Error(`Language '${language}' already exists`);
  }

  await fs.ensureDir(langDir);

  const info = getLanguageInfo(language);

  const claudeMd = TUTOR_TEMPLATE
    .replace(/\{\{LANGUAGE_NAME\}\}/g, language)
    .replace(/\{\{LANGUAGE_NATIVE\}\}/g, info.nativeScript)
    .replace(/\{\{ROMANIZATION\}\}/g, info.romanization)
    .replace(/\{\{LANGUAGE_SPECIFIC_NOTES\}\}/g, info.notes);

  await writeLanguageFile(langDir, 'CLAUDE.md', claudeMd);

  const vocab = VOCABULARY_TEMPLATE.replace(/\{\{LANGUAGE_NAME\}\}/g, language);
  await writeLanguageFile(langDir, 'vocabulary.json', vocab);

  const grammar = GRAMMAR_TEMPLATE.replace(/\{\{LANGUAGE_NAME\}\}/g, language);
  await writeLanguageFile(langDir, 'grammar.json', grammar);

  const overrides = USER_OVERRIDES_TEMPLATE.replace(/\{\{LANGUAGE_NAME\}\}/g, language);
  await writeLanguageFile(langDir, 'user-overrides.json', overrides);

  const config = {
    language,
    native_script: info.nativeScript,
    romanization: info.romanization,
    started: new Date().toISOString().split('T')[0],
  };
  await writeLanguageFile(langDir, 'config.json', JSON.stringify(config, null, 2));

  return `Successfully bootstrapped ${language}`;
}

export async function listLanguages(): Promise<string[]> {
  const dataDir = getDataDir();

  if (!(await fs.pathExists(dataDir))) {
    return [];
  }

  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => capitalizeFirst(entry.name));
}

export async function deleteLanguage(language: string): Promise<string> {
  const langDir = getLanguageDir(language);

  if (!(await fs.pathExists(langDir))) {
    throw new Error(`Language '${language}' does not exist`);
  }

  await fs.remove(langDir);
  return `Deleted ${language}`;
}

export async function getVocabulary(language: string): Promise<string> {
  const vocabFile = path.join(getLanguageDir(language), 'vocabulary.json');
  return fs.readFile(vocabFile, 'utf-8');
}

export async function getGrammar(language: string): Promise<string> {
  const grammarFile = path.join(getLanguageDir(language), 'grammar.json');
  return fs.readFile(grammarFile, 'utf-8');
}
