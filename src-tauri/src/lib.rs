use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

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

/// Timeout for the background tracker agent
const TRACKER_TIMEOUT_SECS: u64 = 60;

// ============================================================================
// Language-specific configuration
// ============================================================================

struct LanguageInfo {
    native_script: &'static str,
    romanization: &'static str,
    notes: &'static str,
}

const DEFAULT_LANGUAGE_INFO: LanguageInfo = LanguageInfo {
    native_script: "Native Script",
    romanization: "none",
    notes: r#"## Language-Specific Considerations

- Research and add language-specific grammar patterns as you encounter them
- Pay attention to any unique features of this language
- Adapt greeting and teaching style to cultural norms
- Start with the simplest possible greeting and self-introduction"#,
};

fn get_language_info(language: &str) -> LanguageInfo {
    match language.to_lowercase().as_str() {
        "chinese" | "mandarin" => LanguageInfo {
            native_script: "汉字",
            romanization: "pinyin",
            notes: r#"## Chinese-Specific Considerations

- **Tones**: Pay attention to tone usage in learner's pinyin (if provided)
- **Characters vs Pinyin**: Track if learner uses characters or pinyin
- **Measure words (量词)**: Track these as grammar constructs
- **Common structures**: 是...的, 把-sentences, 被-passive, 了/过/着 aspects
- **Cold start**: Use "👋 你好 (nǐ hǎo)" - one word with emoji and pinyin"#,
        },
        "korean" => LanguageInfo {
            native_script: "한글",
            romanization: "none",
            notes: r#"## Korean-Specific Considerations

- **Politeness levels**: Track which speech levels the learner knows (합쇼체, 해요체, 해체, etc.)
- **Particles**: Track particles (은/는, 이/가, 을/를, etc.) as grammar
- **Verb conjugation**: Track tense and politeness conjugation patterns
- **Honorifics**: Note when learner uses/should use honorific forms
- **Cold start**: Use "👋 안녕 (annyeong)" - one word with emoji and romanization"#,
        },
        "japanese" => LanguageInfo {
            native_script: "日本語",
            romanization: "romaji",
            notes: r#"## Japanese-Specific Considerations

- **Politeness levels**: Track です/ます vs casual forms
- **Particles**: Track particles (は, が, を, に, で, etc.) as grammar
- **Verb groups**: Note which verb conjugation patterns learner knows
- **Kanji vs Kana**: Track which kanji the learner knows
- **Cold start**: Use "👋 こんにちは (konnichiwa)" - one word with emoji and romaji"#,
        },
        "spanish" => LanguageInfo {
            native_script: "Español",
            romanization: "none",
            notes: r#"## Spanish-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Ser vs Estar**: Track as separate grammar constructs
- **Subjunctive**: Introduce gradually, it's complex
- **Gender agreement**: Track as grammar construct
- **Cold start**: Use "👋 Hola" - one word with emoji"#,
        },
        "french" => LanguageInfo {
            native_script: "Français",
            romanization: "none",
            notes: r#"## French-Specific Considerations

- **Verb conjugation**: Track which tenses and moods learner knows
- **Gender and articles**: Track as grammar constructs
- **Liaisons**: Note pronunciation patterns
- **Formal vs informal (tu/vous)**: Track which the learner uses
- **Cold start**: Use "👋 Bonjour" - one word with emoji"#,
        },
        "german" => LanguageInfo {
            native_script: "Deutsch",
            romanization: "none",
            notes: r#"## German-Specific Considerations

- **Cases**: Track nominative, accusative, dative, genitive separately
- **Verb position**: Track V2 rule, subordinate clause order
- **Gender and articles**: Track der/die/das patterns
- **Formal vs informal (Sie/du)**: Track which the learner uses
- **Cold start**: Use "👋 Hallo" - one word with emoji"#,
        },
        _ => DEFAULT_LANGUAGE_INFO,
    }
}

// ============================================================================
// File system helpers
// ============================================================================

fn find_latest_jsonl_file(dir: &Path) -> Option<PathBuf> {
    let mut jsonl_files: Vec<_> = fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "jsonl"))
        .collect();

    if jsonl_files.is_empty() {
        return None;
    }

    jsonl_files.sort_by(|a, b| {
        let a_time = a.metadata().and_then(|m| m.modified()).ok();
        let b_time = b.metadata().and_then(|m| m.modified()).ok();
        b_time.cmp(&a_time)
    });

    jsonl_files.first().map(|e| e.path())
}

fn parse_chat_messages_from_jsonl(path: &Path) -> Result<Vec<ChatMessage>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open JSONL: {}", e))?;
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

// ============================================================================
// JSON message extraction helpers
// ============================================================================

fn get_message_content<'a>(json: &'a Value, role: &str) -> Option<&'a Value> {
    if json.get("type")?.as_str()? != role {
        return None;
    }
    let msg = json.get("message")?;
    if msg.get("role")?.as_str()? != role {
        return None;
    }
    msg.get("content")
}

fn extract_user_message(json: &Value) -> Option<String> {
    let content = get_message_content(json, "user")?;

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
    let content = get_message_content(json, "assistant")?.as_array()?;

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
    // Windows API flag to prevent spawning a visible console window
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

fn validate_language_name(language: &str) -> Result<(), String> {
    if language.is_empty() {
        return Err("Language name cannot be empty".to_string());
    }
    if language.contains("..") || language.contains('/') || language.contains('\\') {
        return Err("Language name contains invalid characters".to_string());
    }
    if !language.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '-') {
        return Err("Language name can only contain letters, numbers, spaces, and hyphens".to_string());
    }
    Ok(())
}

fn get_language_dir(language: &str) -> Result<PathBuf, String> {
    validate_language_name(language)?;
    Ok(get_data_dir()?.join(language.to_lowercase()))
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// Derives the Claude CLI project path from a directory.
/// E.g., C:\Users\wongp\Desktop\lang\data\korean -> ~/.claude/projects/C--Users-wongp-Desktop-lang-data-korean
fn get_claude_project_dir(dir: &Path) -> Result<PathBuf, String> {
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
// Bootstrap helpers
// ============================================================================

fn write_language_file(dir: &Path, filename: &str, content: &str) -> Result<(), String> {
    fs::write(dir.join(filename), content)
        .map_err(|e| format!("Failed to write {}: {}", filename, e))
}

fn generate_language_files(lang_dir: &Path, language: &str) -> Result<(), String> {
    let info = get_language_info(language);

    let claude_md = TUTOR_TEMPLATE
        .replace("{{LANGUAGE_NAME}}", language)
        .replace("{{LANGUAGE_NATIVE}}", info.native_script)
        .replace("{{ROMANIZATION}}", info.romanization)
        .replace("{{LANGUAGE_SPECIFIC_NOTES}}", info.notes);
    write_language_file(lang_dir, "CLAUDE.md", &claude_md)?;

    let vocab = VOCABULARY_TEMPLATE.replace("{{LANGUAGE_NAME}}", language);
    write_language_file(lang_dir, "vocabulary.json", &vocab)?;

    let grammar = GRAMMAR_TEMPLATE.replace("{{LANGUAGE_NAME}}", language);
    write_language_file(lang_dir, "grammar.json", &grammar)?;

    let overrides = USER_OVERRIDES_TEMPLATE.replace("{{LANGUAGE_NAME}}", language);
    write_language_file(lang_dir, "user-overrides.json", &overrides)?;

    let config = LanguageConfig {
        language: language.to_string(),
        native_script: info.native_script.to_string(),
        romanization: info.romanization.to_string(),
        started: Local::now().format("%Y-%m-%d").to_string(),
    };
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    write_language_file(lang_dir, "config.json", &config_json)
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
fn bootstrap_language(language: String) -> Result<String, String> {
    let lang_dir = get_language_dir(&language)?;

    if lang_dir.exists() {
        return Err(format!("Language '{}' already exists", language));
    }

    fs::create_dir_all(&lang_dir)
        .map_err(|e| format!("Failed to create language directory: {}", e))?;

    generate_language_files(&lang_dir, &language)?;

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

fn spawn_tracker_agent(lang_dir: PathBuf, message: String) {
    tokio::spawn(async move {
        let tracker_dir = lang_dir.join(".tracker");
        if let Err(e) = fs::create_dir_all(&tracker_dir) {
            eprintln!("[Tracker] Failed to create tracker directory: {}", e);
            return;
        }

        let prompt = TRACKER_PROMPT.replace("{{MESSAGE}}", &message);
        let task = tokio::task::spawn_blocking(move || {
            let mut cmd = Command::new("claude");
            cmd.arg("--dangerously-skip-permissions")
                .arg("-p")
                .arg(&prompt)
                .current_dir(&tracker_dir);

            hide_console_window(&mut cmd);
            cmd.output()
        });

        let timeout = Duration::from_secs(TRACKER_TIMEOUT_SECS);
        match tokio::time::timeout(timeout, task).await {
            Err(_) => eprintln!("[Tracker] Timed out after {}s", TRACKER_TIMEOUT_SECS),
            Ok(Err(e)) => eprintln!("[Tracker] Task join error: {}", e),
            Ok(Ok(Err(e))) => eprintln!("[Tracker] Command error: {}", e),
            Ok(Ok(Ok(_))) => {}
        }
    });
}

async fn run_responder_agent(lang_dir: &Path, message: &str) -> Result<String, String> {
    let dir = lang_dir.to_path_buf();
    let msg = message.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new("claude");
        cmd.arg("--dangerously-skip-permissions")
            .arg("--continue")
            .arg("-p")
            .arg(&msg)
            .current_dir(&dir);

        hide_console_window(&mut cmd);
        cmd.output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    if result.status.success() {
        Ok(String::from_utf8_lossy(&result.stdout).trim().to_string())
    } else {
        Err(format!(
            "Claude error: {}",
            String::from_utf8_lossy(&result.stderr).trim()
        ))
    }
}

#[tauri::command]
async fn send_message(message: String, language: String) -> Result<String, String> {
    let lang_dir = get_language_dir(&language)?;

    if !lang_dir.exists() {
        return Err(format!(
            "Language '{}' not set up. Please bootstrap it first.",
            language
        ));
    }

    spawn_tracker_agent(lang_dir.clone(), message.clone());
    run_responder_agent(&lang_dir, &message).await
}

#[tauri::command]
fn get_vocabulary(language: String) -> Result<String, String> {
    let vocab_file = get_language_dir(&language)?.join("vocabulary.json");
    fs::read_to_string(&vocab_file).map_err(|e| format!("Failed to read vocabulary: {}", e))
}

#[tauri::command]
fn get_grammar(language: String) -> Result<String, String> {
    let grammar_file = get_language_dir(&language)?.join("grammar.json");
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
                languages.push(capitalize_first(name));
            }
        }
    }

    Ok(languages)
}

#[tauri::command]
fn delete_language(language: String) -> Result<String, String> {
    let lang_dir = get_language_dir(&language)?;

    if !lang_dir.exists() {
        return Err(format!("Language '{}' does not exist", language));
    }

    fs::remove_dir_all(&lang_dir).map_err(|e| format!("Failed to delete language: {}", e))?;

    Ok(format!("Deleted {}", language))
}

#[tauri::command]
fn get_chat_history(language: String) -> Result<Vec<ChatMessage>, String> {
    let lang_dir = get_language_dir(&language)?;

    if !lang_dir.exists() {
        return Err(format!("Language '{}' not set up", language));
    }

    let claude_project_dir = get_claude_project_dir(&lang_dir)?;

    if !claude_project_dir.exists() {
        return Ok(vec![]);
    }

    match find_latest_jsonl_file(&claude_project_dir) {
        Some(path) => parse_chat_messages_from_jsonl(&path),
        None => Ok(vec![]),
    }
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
