use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Command;

use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
  "mode": "learning",
  "preferences": {
    "new_vocab_per_exchange": 2,
    "show_romanization": true
  },
  "notes": ""
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
// JSON message extraction helpers
// ============================================================================

fn extract_user_message(json: &Value) -> Option<String> {
    if json.get("type")?.as_str()? != "user" {
        return None;
    }

    let msg = json.get("message")?;
    if msg.get("role")?.as_str()? != "user" {
        return None;
    }

    let content = msg.get("content")?;

    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }

    // If content is an array, skip tool results
    if let Some(arr) = content.as_array() {
        if arr.iter().any(|item| {
            item.get("type").and_then(|v| v.as_str()) == Some("tool_result")
        }) {
            return None;
        }
    }

    None
}

fn extract_assistant_message(json: &Value) -> Option<String> {
    if json.get("type")?.as_str()? != "assistant" {
        return None;
    }

    let msg = json.get("message")?;
    if msg.get("role")?.as_str()? != "assistant" {
        return None;
    }

    let content = msg.get("content")?.as_array()?;

    for item in content {
        if item.get("type")?.as_str()? == "text" {
            if let Some(text) = item.get("text")?.as_str() {
                return Some(text.to_string());
            }
        }
    }

    None
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

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,  // "user" or "assistant"
    content: String,
}

// ============================================================================
// Platform helpers
// ============================================================================

/// Configures Command to hide the console window on Windows
#[cfg(windows)]
fn hide_console_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console_window(_cmd: &mut Command) {
    // No-op on non-Windows platforms
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

/// Derives the Claude CLI project path from a directory.
/// E.g., C:\Users\wongp\Desktop\lang\data\korean -> ~/.claude/projects/C--Users-wongp-Desktop-lang-data-korean
fn get_claude_project_dir(dir: &PathBuf) -> Result<PathBuf, String> {
    let canonical = dir
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    let mut path_str = canonical.to_string_lossy().to_string();

    // Remove Windows extended path prefix \\?\ BEFORE any replacements
    if path_str.starts_with(r"\\?\") {
        path_str = path_str[4..].to_string();
    }

    // Convert path to Claude's project folder format:
    // C:\Users\foo\bar -> C--Users-foo-bar
    let encoded = path_str
        .replace(":\\", "--")  // C:\ -> C--
        .replace("\\", "-")    // remaining backslashes
        .replace("/", "-");    // forward slashes (just in case)

    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".claude").join("projects").join(encoded))
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

const TRACKER_PROMPT: &str = r#"[TRACKER TASK - UPDATE FILES ONLY, NO RESPONSE]

Process this learner message and update vocabulary.json and grammar.json.

Learner said: {{MESSAGE}}

Instructions:
1. Read vocabulary.json and grammar.json
2. For each word/particle the learner used:
   - If NEW: add entry with ease=2.5, interval=1, repetitions=1
   - If EXISTS: update SM-2 data (see below)
3. For grammar patterns used:
   - If NEW: add entry with stars=1, correct_streak=1
   - If EXISTS: increment correct_streak, upgrade stars if appropriate
4. Write updated files
5. Output NOTHING - your only job is updating files

SM-2 Algorithm (when learner uses a word correctly):
- repetitions += 1
- if repetitions == 1: interval = 1
- if repetitions == 2: interval = 6
- if repetitions >= 3: interval = round(interval × ease)
- next_review = today + interval days

IMPORTANT: Check for duplicates by word/rule field. Update existing entries, don't create duplicates."#;

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

    // Clone for tracker agent
    let tracker_lang_dir = lang_dir.clone();
    let tracker_message = message.clone();

    // Spawn tracker agent (fire and forget - don't wait for it)
    // Uses a subdirectory so it gets a separate Claude project folder
    let tracker_dir = tracker_lang_dir.join(".tracker");
    let _ = fs::create_dir_all(&tracker_dir);

    tokio::spawn(async move {
        let prompt = TRACKER_PROMPT.replace("{{MESSAGE}}", &tracker_message);
        let result = tokio::task::spawn_blocking(move || {
            let mut cmd = Command::new("claude");
            cmd.arg("--dangerously-skip-permissions")
                .arg("-p")
                .arg(&prompt)
                .current_dir(&tracker_dir);

            hide_console_window(&mut cmd);
            cmd.output()
        })
        .await;

        if let Err(e) = result {
            eprintln!("[Tracker] Task join error: {}", e);
        } else if let Ok(Err(e)) = result {
            eprintln!("[Tracker] Command error: {}", e);
        }
    });

    // Run responder agent (wait for response)
    let result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new("claude");
        cmd.arg("--dangerously-skip-permissions")
            .arg("--continue") // Continue conversation for context
            .arg("-p")
            .arg(&message)
            .current_dir(&lang_dir);

        hide_console_window(&mut cmd);
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

#[tauri::command]
fn get_chat_history(language: String) -> Result<Vec<ChatMessage>, String> {
    let data_dir = get_data_dir()?;
    let lang_dir = data_dir.join(language.to_lowercase());

    if !lang_dir.exists() {
        return Err(format!("Language '{}' not set up", language));
    }

    let claude_project_dir = get_claude_project_dir(&lang_dir)?;

    if !claude_project_dir.exists() {
        return Ok(vec![]);
    }

    // Find the most recent .jsonl file
    let mut jsonl_files: Vec<_> = fs::read_dir(&claude_project_dir)
        .map_err(|e| format!("Failed to read Claude project dir: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "jsonl")
                .unwrap_or(false)
        })
        .collect();

    if jsonl_files.is_empty() {
        return Ok(vec![]);
    }

    // Sort by modification time, most recent first
    jsonl_files.sort_by(|a, b| {
        let a_time = a.metadata().and_then(|m| m.modified()).ok();
        let b_time = b.metadata().and_then(|m| m.modified()).ok();
        b_time.cmp(&a_time)
    });

    let latest_file = &jsonl_files[0].path();
    let file = File::open(latest_file).map_err(|e| format!("Failed to open JSONL: {}", e))?;
    let reader = BufReader::new(file);

    let mut messages = Vec::new();

    for line in reader.lines().flatten() {
        let json: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if let Some(text) = extract_user_message(&json) {
            messages.push(ChatMessage {
                role: "user".to_string(),
                content: text,
            });
        }

        if let Some(text) = extract_assistant_message(&json) {
            messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: text,
            });
        }
    }

    Ok(messages)
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
            delete_language,
            get_chat_history
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to start application: {}", e);
            std::process::exit(1);
        });
}
