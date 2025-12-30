use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use chrono::Local;
use serde::{Deserialize, Serialize};

// ============================================================================
// Embedded Templates
// ============================================================================

const TUTOR_TEMPLATE: &str = include_str!("../../templates/tutor-instructions.md");

const VOCABULARY_TEMPLATE: &str = r#"{
  "language": "{{LANGUAGE_NAME}}",
  "words": []
}"#;

const GRAMMAR_TEMPLATE: &str = r#"{
  "language": "{{LANGUAGE_NAME}}",
  "rules": []
}"#;

const USER_OVERRIDES_TEMPLATE: &str = r#"{
  "language": "{{LANGUAGE_NAME}}",
  "difficulty": {
    "level": "auto",
    "notes": ""
  },
  "preferences": {
    "new_vocab_per_exchange": 2,
    "new_grammar_threshold": 0.8,
    "show_romanization": true
  },
  "adjustments": []
}"#;

// ============================================================================
// Language-specific notes
// ============================================================================

fn get_language_notes(language: &str) -> &'static str {
    match language.to_lowercase().as_str() {
        "chinese" | "mandarin" => r#"## Chinese-Specific Considerations

- **Tones**: Pay attention to tone usage in learner's pinyin (if provided)
- **Characters vs Pinyin**: Track if learner uses characters or pinyin
- **Measure words (量词)**: Track these as grammar constructs
- **Common structures**: 是...的, 把-sentences, 被-passive, 了/过/着 aspects
- **Cold start**: Use "👋 你好 (nǐ hǎo)" - one word with emoji and pinyin"#,
        "korean" => r#"## Korean-Specific Considerations

- **Politeness levels**: Track which speech levels the learner knows (합쇼체, 해요체, 해체, etc.)
- **Particles**: Track particles (은/는, 이/가, 을/를, etc.) as grammar
- **Verb conjugation**: Track tense and politeness conjugation patterns
- **Honorifics**: Note when learner uses/should use honorific forms
- **Cold start**: Use "👋 안녕 (annyeong)" - one word with emoji and romanization"#,
        "japanese" => r#"## Japanese-Specific Considerations

- **Politeness levels**: Track です/ます vs casual forms
- **Particles**: Track particles (は, が, を, に, で, etc.) as grammar
- **Verb groups**: Note which verb conjugation patterns learner knows
- **Kanji vs Kana**: Track which kanji the learner knows
- **Cold start**: Use "👋 こんにちは (konnichiwa)" - one word with emoji and romaji"#,
        "spanish" => r#"## Spanish-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Ser vs Estar**: Track as separate grammar constructs
- **Subjunctive**: Introduce gradually, it's complex
- **Gender agreement**: Track as grammar construct
- **Cold start**: Use "👋 Hola" - one word with emoji"#,
        "french" => r#"## French-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Gender and articles**: Track as grammar constructs
- **Liaisons**: Note pronunciation patterns
- **Formal vs informal (tu/vous)**: Track which the learner uses
- **Cold start**: Use "👋 Bonjour" - one word with emoji"#,
        "german" => r#"## German-Specific Considerations

- **Cases**: Track nominative, accusative, dative, genitive separately
- **Verb position**: Track V2 rule, subordinate clause order
- **Gender and articles**: Track der/die/das patterns
- **Formal vs informal (Sie/du)**: Track which the learner uses
- **Cold start**: Use "👋 Hallo" - one word with emoji"#,
        _ => r#"## Language-Specific Considerations

- Research and add language-specific grammar patterns as you encounter them
- Pay attention to any unique features of this language
- Adapt greeting and teaching style to cultural norms
- Start with the simplest possible greeting and self-introduction"#,
    }
}

fn get_language_config(language: &str) -> (&'static str, &'static str) {
    // Returns (native_script, romanization)
    match language.to_lowercase().as_str() {
        "chinese" | "mandarin" => ("汉字", "pinyin"),
        "korean" => ("한글", "none"),
        "japanese" => ("日本語", "romaji"),
        "spanish" => ("Español", "none"),
        "french" => ("Français", "none"),
        "german" => ("Deutsch", "none"),
        _ => ("Native Script", "none"),
    }
}

// ============================================================================
// Data types
// ============================================================================

#[derive(Serialize, Deserialize)]
struct LanguageConfig {
    language: String,
    native_script: String,
    romanization: String,
    started: String,
}

// ============================================================================
// Path helpers
// ============================================================================

fn get_exe_dir() -> Result<PathBuf, String> {
    env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Failed to get exe directory".to_string())
}

fn get_data_dir() -> Result<PathBuf, String> {
    Ok(get_exe_dir()?.join("data"))
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
fn bootstrap_language(language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let lang_lower = language.to_lowercase();
    let lang_dir = data_dir.join(&lang_lower);

    // Check if already exists
    if lang_dir.exists() {
        return Err(format!("Language '{}' already exists", language));
    }

    // Create directory
    fs::create_dir_all(&lang_dir)
        .map_err(|e| format!("Failed to create language directory: {}", e))?;

    // Get language-specific config
    let (native_script, romanization) = get_language_config(&language);
    let language_notes = get_language_notes(&language);

    // Generate CLAUDE.md
    let claude_md = TUTOR_TEMPLATE
        .replace("{{LANGUAGE_NAME}}", &language)
        .replace("{{LANGUAGE_NATIVE}}", native_script)
        .replace("{{ROMANIZATION}}", romanization)
        .replace("{{LANGUAGE_SPECIFIC_NOTES}}", language_notes);
    fs::write(lang_dir.join("CLAUDE.md"), claude_md)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    // Generate vocabulary.json
    let vocab = VOCABULARY_TEMPLATE.replace("{{LANGUAGE_NAME}}", &language);
    fs::write(lang_dir.join("vocabulary.json"), vocab)
        .map_err(|e| format!("Failed to write vocabulary.json: {}", e))?;

    // Generate grammar.json
    let grammar = GRAMMAR_TEMPLATE.replace("{{LANGUAGE_NAME}}", &language);
    fs::write(lang_dir.join("grammar.json"), grammar)
        .map_err(|e| format!("Failed to write grammar.json: {}", e))?;

    // Generate user-overrides.json
    let overrides = USER_OVERRIDES_TEMPLATE.replace("{{LANGUAGE_NAME}}", &language);
    fs::write(lang_dir.join("user-overrides.json"), overrides)
        .map_err(|e| format!("Failed to write user-overrides.json: {}", e))?;

    // Generate config.json
    let config = LanguageConfig {
        language: language.clone(),
        native_script: native_script.to_string(),
        romanization: romanization.to_string(),
        started: Local::now().format("%Y-%m-%d").to_string(),
    };
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(lang_dir.join("config.json"), config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(format!("Successfully bootstrapped {}", language))
}

#[tauri::command]
async fn send_message(message: String, language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let lang_dir = data_dir.join(language.to_lowercase());

    if !lang_dir.exists() {
        return Err(format!(
            "Language '{}' not set up. Please bootstrap it first.",
            language
        ));
    }

    // Run in blocking task to not freeze UI
    let result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new("claude");
        cmd.arg("--dangerously-skip-permissions") // Bypass permission prompts
            .arg("--continue") // Continue most recent conversation in this directory
            .arg("-p")
            .arg(&message)
            .current_dir(&lang_dir);

        // Hide console window on Windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    if result.status.success() {
        let response = String::from_utf8_lossy(&result.stdout).to_string();
        Ok(response.trim().to_string())
    } else {
        let error = String::from_utf8_lossy(&result.stderr).to_string();
        Err(format!("Claude error: {}", error))
    }
}

#[tauri::command]
fn get_vocabulary(language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let vocab_file = data_dir
        .join(language.to_lowercase())
        .join("vocabulary.json");

    fs::read_to_string(&vocab_file).map_err(|e| format!("Failed to read vocabulary: {}", e))
}

#[tauri::command]
fn get_grammar(language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let grammar_file = data_dir
        .join(language.to_lowercase())
        .join("grammar.json");

    fs::read_to_string(&grammar_file).map_err(|e| format!("Failed to read grammar: {}", e))
}

#[tauri::command]
fn list_languages() -> Result<Vec<String>, String> {
    let data_dir = get_data_dir()?;

    if !data_dir.exists() {
        return Ok(vec![]);
    }

    let mut languages = Vec::new();
    let entries =
        fs::read_dir(&data_dir).map_err(|e| format!("Failed to read data directory: {}", e))?;

    for entry in entries.flatten() {
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                // Capitalize first letter
                let capitalized = name
                    .chars()
                    .next()
                    .map(|c| c.to_uppercase().collect::<String>() + &name[1..])
                    .unwrap_or_else(|| name.to_string());
                languages.push(capitalized);
            }
        }
    }

    Ok(languages)
}

#[tauri::command]
fn delete_language(language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let lang_dir = data_dir.join(language.to_lowercase());

    if !lang_dir.exists() {
        return Err(format!("Language '{}' does not exist", language));
    }

    fs::remove_dir_all(&lang_dir).map_err(|e| format!("Failed to delete language: {}", e))?;

    Ok(format!("Deleted {}", language))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            bootstrap_language,
            send_message,
            get_vocabulary,
            get_grammar,
            list_languages,
            delete_language
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
